import Memory "./memory/ratiocine/v1";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import NC "mo:neutron-capabilities";

module {

    public type AppBackendEnvironment = {
        stable_memory : {
            ratiocine : Memory.Mem;
        };
        capabilities : {
            https_outcalls : NC.HttpsOutcallsV1;
            chain_key_signing : NC.ChainKeySigningV1;
        };
    };

    public class Init(env : AppBackendEnvironment) {
        let mem = env.stable_memory.ratiocine;
        let out = env.capabilities.https_outcalls;
        let ck = env.capabilities.chain_key_signing;

        // Probe 1: does an HTTPS outcall reach the hosted Ration solver API
        // from a (local PocketIC) canister?
        public func /*update*/ping_solver() : async* Text {
            let seq = mem.seq;
            mem.seq := seq + 1;
            let key = "ration-solve-000000" # Nat.toText(seq);
            let body = Text.encodeUtf8(
                "{\"context\":\"suna: sun; bade: big; suna bade: big sun; me: my\",\"query\":\"Translate into the unfamiliar language: 1. the big sun\",\"task_type\":\"translation\"}"
            );
            let result = await* out.request({
                endpoint = "solver";
                method = #post;
                path = "solve";
                query_params = [];
                headers = [
                    { name = "content-type"; value = "application/json" }
                ];
                body = body;
                idempotency_key = ?key;
            });
            switch (result) {
                case (#ok(response)) {
                    let status = "status=" # Nat.toText(response.status);
                    switch (Text.decodeUtf8(response.body)) {
                        case (?t) { status # " body=" # t };
                        case (null) { status # " body=<decode failed>" };
                    };
                };
                case (#err(e)) { "outcall_err=" # showOutErr(e) };
            };
        };

        // Probe 2: can the installation-isolated chain-key slot sign a bounded
        // assertion?
        public func /*update*/sign_probe(msg : Text) : async* Text {
            let result = await* ck.sign_assertion({
                slot = "ration_assertions";
                assertion = Text.encodeUtf8(msg);
            });
            switch (result) {
                case (#ok(s)) {
                    "sig_ok slot=" # s.slot
                        # " alg=" # showAlg(s.algorithm)
                        # " digest_len=" # Nat.toText(s.digest.size())
                        # " sig_len=" # Nat.toText(s.signature.size())
                };
                case (#err(e)) { "sign_err=" # showCkErr(e) };
            };
        };

        // Probe 3: fetch the normalized public key for the slot.
        public func /*update*/get_pubkey() : async* Text {
            let result = await* ck.public_key("ration_assertions");
            switch (result) {
                case (#ok(k)) {
                    "pubkey_ok slot=" # k.slot
                        # " key_len=" # Nat.toText(k.public_key.size())
                        # " fp_len=" # Nat.toText(k.key_fingerprint.size())
                };
                case (#err(e)) { "pubkey_err=" # showCkErr(e) };
            };
        };

        func showAlg(a : NC.ChainKeyAlgorithmV1) : Text {
            switch (a) {
                case (#ecdsa_secp256k1) { "ecdsa_secp256k1" };
                case (#schnorr_bip340secp256k1) { "schnorr_bip340secp256k1" };
                case (#schnorr_ed25519) { "schnorr_ed25519" };
            };
        };

        func showCkErr(e : NC.ChainKeySigningErrorV1) : Text {
            switch (e) {
                case (#invalid_request) { "invalid_request" };
                case (#not_declared) { "not_declared" };
                case (#disabled) { "disabled" };
                case (#busy) { "busy" };
                case (#cost_too_high) { "cost_too_high" };
                case (#low_cycles) { "low_cycles" };
                case (#key_unavailable) { "key_unavailable" };
                case (#management_failure) { "management_failure" };
                case (#outcome_unknown) { "outcome_unknown" };
                case (#source_gone) { "source_gone" };
                case (#revoked_after_dispatch) { "revoked_after_dispatch" };
            };
        };

        func showOutErr(e : NC.HttpsOutcallErrorV1) : Text {
            switch (e) {
                case (#invalid_request) { "invalid_request" };
                case (#not_declared) { "not_declared" };
                case (#disabled) { "disabled" };
                case (#busy) { "busy" };
                case (#cost_too_high) { "cost_too_high" };
                case (#low_cycles) { "low_cycles" };
                case (#redirected) { "redirected" };
                case (#management_failure) { "management_failure" };
                case (#source_gone) { "source_gone" };
                case (#revoked_after_dispatch) { "revoked_after_dispatch" };
            };
        };
    };

/*---NEUTRON GENERATED BEGIN---*/

public type ping_solver_Input = ();
public type ping_solver_Output = Text;

public type sign_probe_Input = (msg : Text);
public type sign_probe_Output = Text;

public type get_pubkey_Input = ();
public type get_pubkey_Output = Text;

/*---NEUTRON GENERATED END---*/
}
