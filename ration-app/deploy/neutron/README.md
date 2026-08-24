# Ration production Neutron/ICP configuration

These are deliberately **fail-closed templates** for the local `neutron/`
clone. They are copied to that clone's root by `scripts/sync-ration-app.sh`,
but are not runnable until an ICP owner supplies a real deployment target and
pins the exact release archives.

## Prepare a release plan

From the repository root:

```bash
./scripts/sync-ration-app.sh
cd neutron
npm --workspace neutron-ratiocine run package

cp ration-production.example.ndeploy.json ration-production.ndeploy.json
cp ration-production.artifacts.example.json ration-production.artifacts.json
```

Replace every `__REQUIRED_...__` value with reviewed production values:

1. A canonical ICP subnet principal compatible with the selected Registry
   pricing profile.
2. The CMC `payment_icp` amount and the local `icblast` `identity_id` whose
   default account will fund it. Never put private key material or an account
   credential in either JSON file.
3. The certified ICP root-key SHA-256 for the Registry evidence policy.
4. Optional backup management-controller principals. `[]` means no additional
   backup controllers; the selected deployer remains a controller at creation.
5. SHA-256 and byte-count pins for the exact `kernel.v0.3.7.neutron` and the
   just-packaged `ratiocine.v0.3.0.neutron` archives. Do not reuse hashes from
   another build or package version.

The template intentionally uses invalid marker strings for deployment-critical
fields. This prevents accidental targeting, payment, or archive installation.
It is safe to commit the templates; the filled `ration-production*.json` files
belong to the local `neutron/` clone and must be reviewed by the operator.

## Validation and execution boundary

```bash
# Validates the selected target/artifact set and reads only the local journal.
npm run provision -- ration-production.ndeploy.json status

# A live ICP read-only preflight: verifies Registry/ledger/CMC/subnet facts.
npm run provision -- ration-production.ndeploy.json create
```

`create --execute` is the separate, paid public action: it funds the CMC route,
creates a canister, installs the Kernel and Ration, and writes a local session
receipt. Do not run it until the ICP owner has explicitly approved the exact
subnet, selected identity, payment amount, controller set, archive pins, and
public deployment.

After a successful public deployment, record the canister/tile URL, configure
`NEXT_PUBLIC_RATION_TILE_URL` for the showcase, then implement and test the
certificate-aware report verifier against that deployed endpoint.
