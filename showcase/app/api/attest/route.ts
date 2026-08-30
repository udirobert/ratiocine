// Server-side Ration attestation relay.
// Calls the mainnet Neutron canister's `attest_entry` update method with the
// deployer identity (a kernel controller), signing the Candid request via
// @dfinity/agent. The browser cannot sign this call itself (no private key),
// so it POSTs the attestation payload here and Vercel relays it.
//
// SECURITY: This route signs with the deployer identity. Guard it with a
// shared secret (RATION_ATTEST_TOKEN) so arbitrary browsers can't spam the
// canister ledger. Calls are fire-and-forget from the client — a 200 means
// "accepted for relay", the canister result (or an error) is returned in the
// body for logging.
//
// Requires env vars on Vercel:
//   RATION_DEPLOYER_SECRET — the base blast secret string (identity 0 is
//     derived deterministically from it, matching the canister deployer).
//   RATION_ATTEST_TOKEN   — shared token the client must send as
//     Authorization: Bearer <token> (optional; if unset the route accepts
//     but still requires the deployer secret).
import { createHash } from "node:crypto";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { Actor, HttpAgent } from "@dfinity/agent";
import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";

const CANISTER = "cvrwv-mqaaa-aaaai-ax4pa-cai";
const HOST = "https://icp-api.io";

// Deterministic identity derivation — mirror of icblast's hashIdentity(id=0).
function deriveDeployerIdentity(secretStr: string): Ed25519KeyIdentity {
  const length = secretStr.length;
  const window = Math.min(128, length);
  const index = length > 0 ? 0 % length : 0;
  const part = (secretStr + secretStr).substring(index, index + window);
  const seed = createHash("sha256").update(part + "0").digest();
  return Ed25519KeyIdentity.generate(new Uint8Array(seed));
}

// v0.4.0 attest_entry Candid interface, hand-wired from the live canister.
const idlFactory: IDL.InterfaceFactory = ({ IDL: N }) => {
  const t = N.Text;
  const opt = N.Opt(t);
  const LedgerEntry = N.Record({
    assertion: t,
    assertion_hash: t,
    case_hash: opt,
    case_version: opt,
    chrf: N.Opt(N.Float64),
    context_hash: t,
    em: N.Opt(N.Float64),
    grading_version: t,
    ground_truth_hash: opt,
    human_outcome_hash: opt,
    job_id: t,
    model: t,
    pred: N.Vec(t),
    problem_id: t,
    prompt: t,
    prompt_hash: t,
    score: N.Opt(N.Float64),
    seq: N.Nat,
    signature: N.Vec(N.Nat8),
    ts: N.Int,
  });
  const AttestInput = N.Record({
    case_hash: opt,
    case_version: opt,
    context: t,
    evaluator_version: t,
    ground_truth: N.Opt(N.Vec(t)),
    human_outcome: N.Opt(
      N.Record({
        answers: N.Vec(t),
        attempts: N.Vec(N.Nat),
        elapsed_s: N.Nat,
        gated_context_revealed: N.Bool,
        hints_used: N.Nat,
      }),
    ),
    job_id: t,
    model: t,
    model_version: opt,
    pred: N.Vec(t),
    problem_id: t,
    prompt: t,
    task_type: opt,
  });
  return N.Service({
    app_ratiocine__attest_entry: N.Func(
      [AttestInput],
      [N.Variant({ attested: LedgerEntry, error: t })],
      ["update"],
    ),
  });
};

interface AttestPayload {
  job_id: string;
  problem_id: string;
  context: string;
  prompt: string;
  pred: string[];
  model: string;
  model_version?: string;
  evaluator_version: string;
  task_type?: string;
  ground_truth?: string[];
  case_version?: string;
  case_hash?: string;
  human_outcome?: {
    answers: string[];
    attempts: number[];
    elapsed_s: number;
    gated_context_revealed: boolean;
    hints_used: number;
  };
}

export async function POST(req: Request) {
  const secret = process.env.RATION_DEPLOYER_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "RATION_DEPLOYER_SECRET not set" }, { status: 500 });
  }

  // Optional bearer token gate.
  const relayToken = process.env.RATION_ATTEST_TOKEN;
  if (relayToken) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${relayToken}`) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  let payload: AttestPayload;
  try {
    payload = (await req.json()) as AttestPayload;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!payload?.job_id || !payload?.prompt || !Array.isArray(payload?.pred)) {
    return Response.json({ ok: false, error: "missing required fields" }, { status: 400 });
  }

  try {
    const identity = deriveDeployerIdentity(secret);
    const agent = await HttpAgent.create({ host: HOST, identity });
    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: Principal.fromText(CANISTER),
    });

    const result = (await actor.app_ratiocine__attest_entry({
      case_hash: payload.case_hash ? [payload.case_hash] : [],
      case_version: payload.case_version ? [payload.case_version] : [],
      context: payload.context,
      evaluator_version: payload.evaluator_version,
      ground_truth: payload.ground_truth ? [payload.ground_truth] : [],
      human_outcome: payload.human_outcome
        ? [
            {
              answers: payload.human_outcome.answers,
              attempts: payload.human_outcome.attempts,
              elapsed_s: payload.human_outcome.elapsed_s,
              gated_context_revealed: payload.human_outcome.gated_context_revealed,
              hints_used: payload.human_outcome.hints_used,
            },
          ]
        : [],
      job_id: payload.job_id,
      model: payload.model,
      model_version: payload.model_version ? [payload.model_version] : [],
      pred: payload.pred,
      problem_id: payload.problem_id,
      prompt: payload.prompt,
      task_type: payload.task_type ? [payload.task_type] : [],
    })) as { attested: any; error?: string };

    if (result.error) {
      return Response.json({ ok: false, error: result.error }, { status: 502 });
    }
    const e = result.attested;
    return Response.json({
      ok: true,
      seq: e.seq.toString(),
      assertion_hash: e.assertion_hash,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: String(err?.message ?? err).slice(0, 300) },
      { status: 502 },
    );
  }
}
