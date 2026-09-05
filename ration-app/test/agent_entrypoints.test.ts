// Agent Mode entrypoint integration test.
//
// The three /*internal:apps*/ functions are thin wrappers over the public
// surface (attest_entry / get_ledger / publish_report). The wrapped methods
// are verified live against local PocketIC by probe_local.ts,
// smoke_ledger.ts, smoke_report.ts, and upgrade_demo.ts. This test pins the
// other half of the integration: the capability declaration, the internal
// definitions, the generated agent-catalog types, and the delegation bodies.
// If any side drifts, packaging or this test fails before submission.

import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");

const WRAPPERS: Array<{ name: string; delegatesTo: string }> = [
  { name: "ration_attest", delegatesTo: "attest_entry" },
  { name: "ration_ledger", delegatesTo: "get_ledger" },
  { name: "ration_report", delegatesTo: "publish_report" },
];

test("agent_entrypoints capability declares exactly the three wrappers", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "neutron.json"), "utf8"));
  const cap = manifest.capabilities?.agent_entrypoints;
  expect(cap).toBeDefined();
  expect(cap.api).toBe(1);
  expect([...cap.entrypoints].sort()).toEqual(
    WRAPPERS.map((w) => w.name).sort(),
  );
});

test("each entrypoint is defined as /*internal:apps*/ and delegates", () => {
  const src = fs.readFileSync(path.join(ROOT, "backend", "main.mo"), "utf8");
  for (const { name, delegatesTo } of WRAPPERS) {
    const def = new RegExp(`public func /\\*internal:apps\\*/${name}\\(`);
    expect(src, `${name} internal definition`).toMatch(def);
    // Body must call the wrapped method (no logic may hide in the wrapper).
    const body = new RegExp(
      `${name}\\([\\s\\S]{0,400}?await\\* ${delegatesTo}\\(`,
    );
    expect(src, `${name} delegates to ${delegatesTo}`).toMatch(body);
  }
});

test("mogen generated agent-catalog types for every wrapper", () => {
  const src = fs.readFileSync(path.join(ROOT, "backend", "main.mo"), "utf8");
  const begin = src.indexOf("NEUTRON GENERATED BEGIN");
  const end = src.indexOf("NEUTRON GENERATED END");
  expect(begin, "generated block present").toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(begin);
  const block = src.slice(begin, end);
  for (const { name } of WRAPPERS) {
    expect(block, `${name}_Input generated`).toContain(`${name}_Input`);
    expect(block, `${name}_Output generated`).toContain(`${name}_Output`);
  }
});

test("packaged schema exposes the wrapped public surface", () => {
  const schemaPath = path.join(ROOT, "dist", "schema.json");
  if (!fs.existsSync(schemaPath)) {
    console.warn("dist/schema.json absent (run package first) — skipping");
    return;
  }
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  for (const method of ["attest_entry", "get_ledger", "publish_report"]) {
    expect(schema.methods?.[method], `schema has ${method}`).toBeDefined();
  }
});
