import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Char "mo:core/Char";
import Float "mo:core/Float";
import Int "mo:core/Int";
import Int64 "mo:core/Int64";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Nat32 "mo:core/Nat32";
import Nat64 "mo:core/Nat64";
import Nat8 "mo:core/Nat8";
import Text "mo:core/Text";
import Time "mo:core/Time";
import SHA256 "mo:sha2/Sha256";
import NC "mo:neutron-capabilities";
import Memory "./memory/ratiocine/v3";

module {

    public type AppBackendEnvironment = {
        stable_memory : {
            ratiocine : Memory.Mem;
        };
        capabilities : {
            https_outcalls : NC.HttpsOutcallsV1;
            chain_key_signing : NC.ChainKeySigningV1;
            certified_assets : NC.CertifiedAssetsV2;
        };
    };

    // Browser-supplied human outcome for a canonical public case. It is bound
    // into the signed assertion, but is intentionally not identity proof.
    public type HumanOutcome = {
        answers : [Text];
        attempts : [Nat];
        hints_used : Nat;
        elapsed_s : Nat;
        gated_context_revealed : Bool;
    };

    public type AttestInput = {
        job_id : Text;
        problem_id : Text;
        context : Text;
        prompt : Text;
        pred : [Text];
        model : Text;
        model_version : ?Text;
        evaluator_version : Text;
        task_type : ?Text;
        ground_truth : ?[Text];
        case_version : ?Text;
        case_hash : ?Text;
        human_outcome : ?HumanOutcome;
    };

    public type AttestResult = {
        #attested : LedgerEntry;
        #error : Text;
    };

    // Wire-visible copy of the ledger record (structurally identical to
    // Memory.LedgerEntry; declared here so the app-method schema can resolve
    // it without following the memory import).
    public type LedgerEntry = {
        seq : Nat;
        ts : Int;
        job_id : Text;
        problem_id : Text;
        context_hash : Text;
        prompt : Text;
        prompt_hash : Text;
        ground_truth_hash : ?Text;
        case_version : ?Text;
        case_hash : ?Text;
        human_outcome_hash : ?Text;
        grading_version : Text;
        pred : [Text];
        model : Text;
        em : ?Float;
        chrf : ?Float;
        score : ?Float;
        assertion : Text;
        assertion_hash : Text;
        signature : Blob;
    };

    public class Init(env : AppBackendEnvironment) {
        let mem = env.stable_memory.ratiocine;
        let out = env.capabilities.https_outcalls;
        let ck = env.capabilities.chain_key_signing;
        let cas = env.capabilities.certified_assets;

        // ===================== M3: grade -> sign -> ledger =====================

        // Grade a model answer deterministically in-canister, chain-key sign
        // the assertion, and append the receipt to the stable ledger.
        public func /*update*/attest_entry(input : AttestInput) : async* AttestResult {
            let context_hash = sha256Hex(Text.encodeUtf8(input.context));
            let prompt_hash = sha256Hex(Text.encodeUtf8(input.prompt));
            let ground_truth_hash = optHash(input.ground_truth);
            let human_outcome_hash = optHumanOutcomeHash(input.human_outcome);
            let grade = computeGrade(input.pred, input.ground_truth);

            let ts = Int.abs(Time.now()) / 1_000_000_000;
            let seq = mem.seq;
            mem.seq := seq + 1;

            // Canonical compact assertion: the exact bytes the subnet signs.
            var assertion = buildAssertion(
                seq, ts, input, context_hash, prompt_hash, ground_truth_hash,
                human_outcome_hash, grade,
            );
            if (Text.encodeUtf8(assertion).size() > 3800) {
                assertion := buildCompactAssertion(
                    seq, ts, input, context_hash, prompt_hash, ground_truth_hash,
                    human_outcome_hash, grade,
                );
            };

            let sign = await* ck.sign_assertion({
                slot = "ration_assertions";
                assertion = Text.encodeUtf8(assertion);
            });
            switch (sign) {
                case (#ok(s)) {
                    let entry : LedgerEntry = {
                        seq;
                        ts;
                        job_id = input.job_id;
                        problem_id = input.problem_id;
                        context_hash;
                        prompt = input.prompt;
                        prompt_hash;
                        ground_truth_hash;
                        case_version = input.case_version;
                        case_hash = input.case_hash;
                        human_outcome_hash;
                        grading_version = "ration/ordered-v1";
                        pred = input.pred;
                        model = input.model;
                        em = grade.em;
                        chrf = grade.chrf;
                        score = grade.score;
                        assertion;
                        assertion_hash = sha256Hex(Text.encodeUtf8(assertion));
                        signature = s.signature;
                    };
                    mem.ledger := Array.concat(mem.ledger, [entry]);
                    #attested(entry);
                };
                case (#err(e)) {
                    #error("sign_failed: " # showCkErr(e));
                };
            };
        };

        // The certified reasoning logbook.
        public func /*update*/get_ledger() : async* [LedgerEntry] {
            mem.ledger;
        };

        // ================ M4: certified ledger report publication ================

        // The full ledger as one self-contained, content-addressed certified
        // asset. Published immutably: each distinct report is a new object at
        // /v1/ledger/report/<sha256-hex>, witness-verifiable against the ICP
        // root key, and re-publishing identical content is an idempotent no-op.

        func blobHex(b : Blob) : Text {
            var out = "";
            var i : Nat = 0;
            while (i < b.size()) {
                let n = Nat8.toNat(b[i]);
                out #= HEX[n / 16] # HEX[n % 16];
                i := i + 1;
            };
            out;
        };

        func floatText(f : ?Float) : Text {
            switch (f) {
                case (null) { "null" };
                case (?v) { Float.toText(v) };
            };
        };

        func optTextJson(v : ?Text) : Text {
            switch (v) {
                case (null) { "null" };
                case (?text) { "\"" # jsonEscape(text) # "\"" };
            };
        };

        func entryJson(e : Memory.LedgerEntry, full : Bool) : Text {
            "{" # "\"seq\":" # Nat.toText(e.seq)
                # ",\"ts\":" # Int.toText(e.ts)
                # ",\"problem_id\":\"" # jsonEscape(e.problem_id) # "\""
                # ",\"pred\":[" # predJson(e.pred) # "]"
                # ",\"model\":\"" # jsonEscape(e.model) # "\""
                # ",\"em\":" # floatText(e.em)
                # ",\"chrf\":" # floatText(e.chrf)
                # ",\"score\":" # floatText(e.score)
                # ",\"context_hash\":\"" # e.context_hash # "\""
                # ",\"prompt_hash\":\"" # e.prompt_hash # "\""
                # ",\"ground_truth_hash\":" # optTextJson(e.ground_truth_hash)
                # ",\"case_version\":" # optTextJson(e.case_version)
                # ",\"case_hash\":" # optTextJson(e.case_hash)
                # ",\"human_outcome_hash\":" # optTextJson(e.human_outcome_hash)
                # ",\"grading_version\":\"" # jsonEscape(e.grading_version) # "\""
                # (if (full) {
                        ",\"assertion\":\"" # jsonEscape(e.assertion) # "\""
                    } else {
                        ""
                    })
                # ",\"assertion_hash\":\"" # e.assertion_hash # "\""
                # ",\"signature\":\"" # blobHex(e.signature) # "\""
                # "}";
        };

        func reportBody(full : Bool) : Text {
            var entries = "[";
            var i : Nat = 0;
            while (i < mem.ledger.size()) {
                if (i > 0) { entries #= ","; };
                entries #= entryJson(mem.ledger[i], full);
                i := i + 1;
            };
            entries #= "]";
            "{" # "\"format\":\"ration.ledger-report.v1\""
                # ",\"app\":\"ratiocine\""
                # (if (full) { "" } else { ",\"mode\":\"compact\"" })
                # ",\"entry_count\":" # Nat.toText(mem.ledger.size())
                # ",\"entries\":" # entries
                # "}";
        };

        func casErrText(e : NC.Error) : Text {
            switch (e) {
                case (#invalid) { "invalid" };
                case (#stale_scope) { "stale_scope" };
                case (#stale_generation(_)) { "stale_generation" };
                case (#disabled) { "disabled" };
                case (#frozen) { "frozen" };
                case (#not_found) { "not_found" };
                case (#retired_key) { "retired_key" };
                case (#conflict(_)) { "conflict" };
                case (#quota) { "quota" };
                case (#receipt_full) { "receipt_full" };
                case (#aborted) { "aborted" };
                case (#expired) { "expired" };
                case (#incomplete(_)) { "incomplete" };
                case (#not_ready) { "not_ready" };
                case (#generation_exhausted) { "generation_exhausted" };
                case (#revision_exhausted) { "revision_exhausted" };
                case (#low_cycles) { "low_cycles" };
                case (#busy) { "busy" };
            };
        };

        // 16-byte idempotency nonce: hex of the first 8 digest bytes (16 ASCII
        // bytes). Deterministic per report, so re-publishing replays cleanly.
        func reportNonce(digest : Blob) : Blob {
            var out = "";
            var i : Nat = 0;
            while (i < 8) {
                let n = Nat8.toNat(digest[i]);
                out #= HEX[n / 16] # HEX[n % 16];
                i := i + 1;
            };
            Text.encodeUtf8(out);
        };

        public func /*update*/publish_report() : async* Text {
            var body = reportBody(true);
            if (Text.encodeUtf8(body).size() > 60000) {
                body := reportBody(false);
            };
            let bodyBytes = Text.encodeUtf8(body);
            let digest = SHA256.fromBlob(#sha256, bodyBytes);

            let scope = switch (cas.scope_info()) {
                case (#ok(s)) { s };
                case (#err(e)) { return "scope_error:" # casErrText(e); };
            };
            var generation : Nat64 = 0;
            var found : Bool = false;
            var i : Nat = 0;
            while (i < scope.collections.size()) {
                let c = scope.collections[i];
                if (c.id == "ledger_report") {
                    generation := c.generation;
                    found := true;
                };
                i := i + 1;
            };
            if (not found) { return "collection_missing" };

            let receipt = cas.commit_batch({
                nonce = reportNonce(digest);
                operations = [
                    #put({
                        target = {
                            collection = "ledger_report";
                            collection_generation = generation;
                            locator = #body_sha256({ digest });
                        };
                        condition = #absent;
                        body = #inline(bodyBytes);
                    })
                ];
                requires_present_after = [];
            });
            switch (receipt) {
                case (#ok(_)) { "published:" # blobHex(digest) };
                case (#err(#conflict(_))) { "already_published:" # blobHex(digest) };
                case (#err(e)) { "publish_error:" # casErrText(e) };
            };
        };

        // ================ Agent Mode entrypoints (internal:apps) ================
        // Wrapper methods that delegate to the internal logic, exposed as typed
        // agent tools.  The *update* modifiers control kernel routing; inside
        // the same class the methods are simple cross-calls.

        public func /*internal:apps*/ration_attest(
            input : AttestInput,
        ) : async* AttestResult {
            await* attest_entry(input);
        };

        public func /*internal:apps*/ration_ledger(()) : async* [LedgerEntry] {
            await* get_ledger();
        };

        public func /*internal:apps*/ration_report(()) : async* Text {
            await* publish_report();
        };

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

        // Expose raw public material as hexadecimal so an external verifier can
        // independently verify a published assertion signature.
        public func /*update*/get_pubkey() : async* Text {
            let result = await* ck.public_key("ration_assertions");
            switch (result) {
                case (#ok(k)) {
                    "{\"slot\":\"" # jsonEscape(k.slot)
                        # "\",\"algorithm\":\"" # showAlg(k.algorithm)
                        # "\",\"public_key_hex\":\"" # blobHex(k.public_key)
                        # "\",\"key_fingerprint_hex\":\"" # blobHex(k.key_fingerprint)
                        # "\"}";
                };
                case (#err(e)) { "{\"error\":\"" # showCkErr(e) # "\"}" };
            };
        };

        // ---------------- deterministic grading (EM + chrF) ----------------

        type Grade = { em : ?Float; chrf : ?Float; score : ?Float };

        // Ordered, one-to-one grade for numbered Linguini-style prompts.
        // Missing or extra items score zero rather than being matched against a
        // different reference answer.
        func computeGrade(pred : [Text], ground : ?[Text]) : Grade {
            switch (ground) {
                case (null) {
                    { em = null; chrf = null; score = null };
                };
                case (?refs) {
                    let n = refs.size();
                    if (n == 0 or pred.size() != n) {
                        { em = ?0.0; chrf = ?0.0; score = ?0.0 };
                    } else {
                        var emSum : Float = 0.0;
                        var chrfSum : Float = 0.0;
                        var i : Nat = 0;
                        while (i < n) {
                            let p = normalize(pred[i]);
                            let r = normalize(refs[i]);
                            if (p == r) { emSum += 1.0; };
                            chrfSum += chrf(p, r);
                            i := i + 1;
                        };
                        let emMean = emSum / natF(n);
                        let chrfMean = chrfSum / natF(n);
                        {
                            em = ?emMean;
                            chrf = ?chrfMean;
                            score = ?Float.sqrt(emMean * chrfMean);
                        };
                    };
                };
            };
        };

        // chrF: character n-gram F-score averaged over n = 1..6.
        func chrf(hyp : Text, ref : Text) : Float {
            var sum : Float = 0.0;
            var n : Nat = 1;
            while (n <= 6) {
                sum += f1AtN(hyp, ref, n);
                n += 1;
            };
            sum / 6.0;
        };

        func f1AtN(hyp : Text, ref : Text, n : Nat) : Float {
            let hm = ngramCounts(hyp, n);
            let rm = ngramCounts(ref, n);
            var overlap : Nat = 0;
            var hypTotal : Nat = 0;
            for ((g, c) in Map.entries(hm)) {
                hypTotal += c;
                let rc = Map.get(rm, Text.compare, g) ?? 0;
                overlap += if (c < rc) c else rc;
            };
            var refTotal : Nat = 0;
            for ((_, c) in Map.entries(rm)) {
                refTotal += c;
            };
            if (hypTotal == 0 and refTotal == 0) {
                1.0;
            } else {
                let p = if (hypTotal == 0) {
                    0.0
                } else {
                    natF(overlap) / natF(hypTotal)
                };
                let r = if (refTotal == 0) {
                    0.0
                } else {
                    natF(overlap) / natF(refTotal)
                };
                if (p + r == 0.0) {
                    0.0
                } else {
                    2.0 * p * r / (p + r)
                };
            };
        };

        func ngramCounts(s : Text, n : Nat) : Map.Map<Text, Nat> {
            let m : Map.Map<Text, Nat> = Map.empty();
            let chars = Text.toArray(s);
            let len = chars.size();
            if (n > len) {
                m;
            } else {
                var i : Nat = 0;
                while (i + n <= len) {
                    var g = "";
                    var j : Nat = 0;
                    while (j < n) {
                        g #= Char.toText(chars[i + j]);
                        j := j + 1;
                    };
                    Map.add(m, Text.compare, g, (Map.get(m, Text.compare, g) ?? 0) + 1);
                    i := i + 1;
                };
                m;
            };
        };

        // lowercase (ASCII fold), trim, collapse whitespace runs
        func normalize(s : Text) : Text {
            let chars = Text.toArray(s);
            let len = chars.size();
            var first : Nat = 0;
            while (first < len and Char.isWhitespace(chars[first])) { first += 1; };
            if (first == len) { return ""; };
            var last : Nat = len - 1;
            while (last > first and Char.isWhitespace(chars[last])) { last -= 1; };
            var out = "";
            var prevSpace : Bool = false;
            var i = first;
            while (i <= last) {
                let c = chars[i];
                if (Char.isWhitespace(c)) {
                    if (not prevSpace) {
                        out #= " ";
                        prevSpace := true;
                    };
                } else {
                    out #= Char.toText(toLowerChar(c));
                    prevSpace := false;
                };
                i += 1;
            };
            out;
        };

        func toLowerChar(c : Char) : Char {
            let n = Char.toNat32(c);
            if (n >= (65 : Nat32) and n <= (90 : Nat32)) {
                Char.fromNat32(n + (32 : Nat32));
            } else {
                c;
            };
        };

        // ---------------- assertion building + hashing ----------------

        let HEX : [Text] = [
            "0", "1", "2", "3", "4", "5", "6", "7",
            "8", "9", "a", "b", "c", "d", "e", "f",
        ];

        func sha256Hex(bytes : Blob) : Text {
            let digest = SHA256.fromBlob(#sha256, bytes);
            var out = "";
            var i : Nat = 0;
            while (i < digest.size()) {
                let n = Nat8.toNat(digest[i]);
                out #= HEX[n / 16] # HEX[n % 16];
                i := i + 1;
            };
            out;
        };

        func joinTexts(values : [Text]) : Text {
            var joined = "";
            var i : Nat = 0;
            while (i < values.size()) {
                if (i > 0) { joined #= "\n"; };
                joined #= values[i];
                i := i + 1;
            };
            joined;
        };

        func optHash(values : ?[Text]) : ?Text {
            switch (values) {
                case (null) { null };
                case (?items) { ?sha256Hex(Text.encodeUtf8(joinTexts(items))) };
            };
        };

        func natJson(values : [Nat]) : Text {
            var out = "";
            var i : Nat = 0;
            while (i < values.size()) {
                if (i > 0) { out #= ","; };
                out #= Nat.toText(values[i]);
                i := i + 1;
            };
            out;
        };

        func humanOutcomeText(outcome : HumanOutcome) : Text {
            "{\"answers\":[" # predJson(outcome.answers) # "]"
                # ",\"attempts\":[" # natJson(outcome.attempts) # "]"
                # ",\"hints_used\":" # Nat.toText(outcome.hints_used)
                # ",\"elapsed_s\":" # Nat.toText(outcome.elapsed_s)
                # ",\"gated_context_revealed\":"
                # (if (outcome.gated_context_revealed) { "true" } else { "false" })
                # "}";
        };

        func optHumanOutcomeHash(outcome : ?HumanOutcome) : ?Text {
            switch (outcome) {
                case (null) { null };
                case (?value) { ?sha256Hex(Text.encodeUtf8(humanOutcomeText(value))) };
            };
        };

        func natF(n : Nat) : Float {
            Float.fromInt64(Int64.fromNat64(Nat64.fromNat(n)));
        };

        // NOTE: char literals like '"' trip a parser bug in the vendored
        // compiler ("malformed operator"); build specials from code points.
        let QUOTE : Char = Char.fromNat32(34);
        let BACKSLASH : Char = Char.fromNat32(92);
        let NEWLINE : Char = Char.fromNat32(10);
        let TAB : Char = Char.fromNat32(9);
        let CARRIAGE : Char = Char.fromNat32(13);

        func jsonEscape(s : Text) : Text {
            let chars = Text.toArray(s);
            var out = "";
            var i : Nat = 0;
            while (i < chars.size()) {
                let c = chars[i];
                if (c == QUOTE) {
                    out #= "\\\"";
                } else if (c == BACKSLASH) {
                    out #= "\\\\";
                } else if (c == NEWLINE) {
                    out #= "\\n";
                } else if (c == TAB) {
                    out #= "\\t";
                } else if (c == CARRIAGE) {
                    out #= "\\r";
                } else {
                    let n32 = Char.toNat32(c);
                    if (n32 < (32 : Nat32)) {
                        var h = "\\u00";
                        let n = Nat32.toNat(n32);
                        h #= HEX[n / 16];
                        h #= HEX[n % 16];
                        out #= h;
                    } else {
                        out #= Char.toText(c);
                    };
                };
                i := i + 1;
            };
            out;
        };

        func predJson(pred : [Text]) : Text {
            var out = "";
            var i : Nat = 0;
            while (i < pred.size()) {
                if (out.size() > 0) { out #= ","; };
                out #= "\"" # jsonEscape(pred[i]) # "\"";
                i := i + 1;
            };
            out;
        };

        func gradeJson(g : Grade) : Text {
            switch (g.em) {
                case (null) { "null" };
                case (?em) {
                    switch (g.score) {
                        case (null) { "null" };
                        case (?score) {
                            "{\"em\":" # Float.toText(em)
                                # ",\"chrf\":" # Float.toText(g.chrf ?? em)
                                # ",\"score\":" # Float.toText(score) # "}";
                        };
                    };
                };
            };
        };

        func assertionCommonHead(
            seq : Nat,
            ts : Nat,
            input : AttestInput,
            context_hash : Text,
            prompt_hash : Text,
            ground_truth_hash : ?Text,
            human_outcome_hash : ?Text,
        ) : Text {
            "\"v\":2,\"seq\":" # Nat.toText(seq)
                # ",\"ts\":" # Nat.toText(ts)
                # ",\"job\":\"" # jsonEscape(input.job_id) # "\""
                # ",\"problem\":\"" # jsonEscape(input.problem_id) # "\""
                # ",\"ctx\":\"" # context_hash # "\""
                # ",\"prompt_h\":\"" # prompt_hash # "\""
                # ",\"ground_h\":" # optTextJson(ground_truth_hash)
                # ",\"case_v\":" # optTextJson(input.case_version)
                # ",\"case_h\":" # optTextJson(input.case_hash)
                # ",\"human_h\":" # optTextJson(human_outcome_hash)
                # ",\"grading\":\"ration/ordered-v1\""
                # ",\"model\":\"" # jsonEscape(input.model) # "\"";
        };

        func buildAssertion(
            seq : Nat,
            ts : Nat,
            input : AttestInput,
            context_hash : Text,
            prompt_hash : Text,
            ground_truth_hash : ?Text,
            human_outcome_hash : ?Text,
            grade : Grade,
        ) : Text {
            "{" # assertionCommonHead(
                    seq, ts, input, context_hash, prompt_hash, ground_truth_hash,
                    human_outcome_hash,
                )
                # ",\"pred\":[" # predJson(input.pred) # "]"
                # ",\"grade\":" # gradeJson(grade) # "}";
        };

        // Fallback when the full assertion would exceed the 4096-byte slot cap:
        // keep the pred hash instead of the raw strings.
        func buildCompactAssertion(
            seq : Nat,
            ts : Nat,
            input : AttestInput,
            context_hash : Text,
            prompt_hash : Text,
            ground_truth_hash : ?Text,
            human_outcome_hash : ?Text,
            grade : Grade,
        ) : Text {
            let joined = joinTexts(input.pred);
            "{" # assertionCommonHead(
                    seq, ts, input, context_hash, prompt_hash, ground_truth_hash,
                    human_outcome_hash,
                )
                # ",\"pred_h\":\"" # sha256Hex(Text.encodeUtf8(joined)) # "\""
                # ",\"grade\":" # gradeJson(grade) # "}";
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

public type attest_entry_Input = AttestInput;
public type attest_entry_Output = AttestResult;

public type get_ledger_Input = ();
public type get_ledger_Output = [LedgerEntry];

public type ping_solver_Input = ();
public type ping_solver_Output = Text;

public type sign_probe_Input = (msg : Text);
public type sign_probe_Output = Text;

public type get_pubkey_Input = ();
public type get_pubkey_Output = Text;

/*---NEUTRON GENERATED END---*/
}
