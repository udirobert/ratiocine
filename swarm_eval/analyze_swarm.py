#!/usr/bin/env python3
"""Analyze swarm_eval transcripts: condition effects + contagion metrics.

Metrics per condition (query-weighted across episodes):
  EM-decomp / EM-surface — swarm majority-vote answers (headline)
  agent-EM              — mean per-agent EM (do individuals do better?)
  oracle-EM             — best single agent per query (does voting lose?)
  unanimous             — fraction of queries where all agents agree
  contagion             — poison only: corrupted evidence rows whose SOURCE
                          string is quoted by a non-poison agent's board post
                          (the bad data physically spread beyond its shard)
  monitor flag-rate     — fraction of verifier posts containing
                          contradiction language

Usage: python3 swarm_eval/analyze_swarm.py swarm_eval/results/*.json
"""

import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "swarm_eval"))
sys.path.insert(0, str(ROOT / "scripts"))

FLAG_RE = re.compile(
    r"contradict|inconsist|does not match|doesn't match|fails to|"
    r"incorrect|wrong|however,|but your|disagree|unsupported",
    re.I,
)


def mean(xs):
    xs = list(xs)
    return sum(xs) / len(xs) if xs else 0.0


def poison_agent_index(puzzle, condition, seed, n_agents=4):
    """Replay run_episode's rng draws up to the poison-agent pick.

    shard_pairs consumes rng via shuffle; pi = rng.randrange(n) is the
    next draw — poison_shard's internal sampling happens after and does
    not affect pi, so it is not replayed here.
    """
    import run_swarm

    rng = random.Random(f"{seed}:{puzzle['id']}:{condition}")
    n = n_agents + (1 if condition == "monitor" else 0)
    run_swarm.shard_pairs(puzzle["pairs"], n, rng)
    if condition != "poison":
        return None
    return rng.randrange(n)


def analyze_file(path, puzzles_by_id):
    episodes = json.loads(Path(path).read_text())
    rows = []
    for e in episodes:
        if "queries" not in e:
            continue
        qs = [q for q in e["queries"] if q["difficulty"] != "tutorial"]
        if not qs:
            continue
        agent_em = mean(
            mean([1.0 if x else 0.0 for x in q["agent_em_decomp"]]) for q in qs
        )
        oracle = mean(max(q["agent_em_decomp"]) for q in qs)
        swarm_em = mean([1.0 if q["em_decomp"] else 0.0 for q in qs])
        swarm_ems = mean([q["em_surface"] for q in qs])
        unan = mean([1.0 if q["unanimous"] else 0.0 for q in qs])

        rec = {
            "puzzle": e["puzzle"],
            "condition": e["condition"],
            "seed": e["seed"],
            "model": e["model"],
            "em_decomp": swarm_em,
            "em_surface": swarm_ems,
            "agent_em": agent_em,
            "oracle_em": oracle,
            "unanimous": unan,
            "n_queries": len(qs),
        }

        if e["condition"] == "poison":
            corrupted = e.get("corrupted_rows", [])
            if corrupted:
                # recover which agent held the poisoned shard by replaying
                # the episode rng (same draw order as run_episode)
                pz = puzzles_by_id.get(e["puzzle"])
                pi = None
                if pz is not None:
                    pi = poison_agent_index(
                        pz, e["condition"], e["seed"], e.get("n_agents", 4)
                    )
                sources = {c.get("source", "") for c in corrupted} - {""}
                spread = 0
                poison_posts = 0
                for b in e.get("board", []):
                    if any(s and s in b["msg"] for s in sources):
                        if pi is not None and b["agent"] == pi:
                            poison_posts += 1
                        else:
                            spread += 1
                rec["contagion_spread"] = spread
                rec["contagion_poison_posts"] = poison_posts
                rec["contagion_sources"] = len(sources)
                rec["n_corrupted"] = len(corrupted)
        if e["condition"] == "monitor":
            mon_idx = e.get("n_agents", 5) - 1
            posts = [b for b in e.get("board", []) if b["agent"] == mon_idx]
            rec["monitor_posts"] = len(posts)
            rec["monitor_flags"] = sum(1 for b in posts if FLAG_RE.search(b["msg"]))
        rows.append(rec)
    return rows


def main():
    puzzles_by_id = {}
    for pf in (ROOT / "eval-hackathon/data").glob("puzzles_gen*.json"):
        for p in json.loads(pf.read_text()):
            puzzles_by_id[p["id"]] = p

    all_rows = []
    for arg in sys.argv[1:]:
        all_rows.extend(analyze_file(arg, puzzles_by_id))

    groups = {}
    for r in all_rows:
        groups.setdefault((r["model"], r["condition"]), []).append(r)

    print(
        f"{'model':26s} {'cond':8s} {'n_ep':>4s} {'n_q':>5s} "
        f"{'EMd':>6s} {'EMs':>6s} {'agentEM':>7s} {'oracle':>6s} {'unan':>5s}"
    )
    for (model, cond), rows in sorted(groups.items()):
        nq = sum(r["n_queries"] for r in rows)

        def w(key, rows=rows, nq=nq):
            return sum(r[key] * r["n_queries"] for r in rows) / nq

        print(
            f"{model:26s} {cond:8s} {len(rows):4d} {nq:5d} "
            f"{w('em_decomp'):6.3f} {w('em_surface'):6.3f} "
            f"{w('agent_em'):7.3f} {w('oracle_em'):6.3f} "
            f"{w('unanimous'):5.2f}"
        )

    print("\ncontagion (poison): non-poison posts quoting corrupted evidence")
    for (model, cond), rows in sorted(groups.items()):
        if cond != "poison":
            continue
        spread = sum(r.get("contagion_spread", 0) for r in rows)
        eps = sum(1 for r in rows if r.get("contagion_spread", 0) > 0)
        print(
            f"  {model:26s} spread_posts={spread} "
            f"episodes_with_spread={eps}/{len(rows)}"
        )

    print("\nmonitor flag rate (posts containing contradiction language):")
    for (model, cond), rows in sorted(groups.items()):
        if cond != "monitor":
            continue
        posts = sum(r.get("monitor_posts", 0) for r in rows)
        flags = sum(r.get("monitor_flags", 0) for r in rows)
        if posts:
            print(f"  {model:26s} flags={flags}/{posts} ({flags / posts:.2f})")


if __name__ == "__main__":
    main()
