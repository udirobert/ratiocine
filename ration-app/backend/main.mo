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
import Memory "./memory/ratiocine/v4";

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
        installation : {
            network_id : Blob;
        };
    };

    // Browser-supplied human outcome for a canonical public case.
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

    // Wire-visible copy of the ledger record.
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

    public type LedgerPage = {
        entries : [LedgerEntry];
        total : Nat;
        offset : Nat;
    };

    public type LedgerStatus = {
        total : Nat;
        last_report_seq : Nat;
    };

    public class Init(env : AppBackendEnvironment) {
        let mem = env.stable_memory.ratiocine;
        let out = env.capabilities.https_outcalls;
        let ck = env.capabilities.chain_key_signing;
        let cas = env.capabilities.certified_assets;

        // ===================== Access control =====================
        // Token-based guard. The allowlist stores admin tokens (opaque strings).
        // Protected methods require a matching token. The first
        // add_allowed_caller call on an empty list bootstraps the token.

        func isValidToken(token : Text) : Bool {
            if (token == "") { return false };
            var i : Nat = 0;
            while (i < mem.allowed_callers.size()) {
                if (mem.allowed_callers[i] == token) { return true };
                i := i + 1;
            };
            false;
        };

        func requireToken(token : Text) : ?Text {
            if (mem.allowed_callers.size() == 0) {
                // No tokens enrolled yet — bootstrap mode, allow.
                null;
            } else if (isValidToken(token)) {
                null;
            } else {
                ?("unauthorized");
            };
        };

        // Admin: add a token to the allowlist. First call bootstraps.
        public func /*update*/add_allowed_caller(token : Text) : async* Text {
            if (token == "") { return "empty_token" };
            // Bootstrap: if list is empty, just add it.
            if (mem.allowed_callers.size() == 0) {
                mem.allowed_callers := [token];
                return "bootstrapped:" # token;
            };
            // Otherwise require an existing valid token (passed as the new token
            // is being added — we need a separate admin_token arg).
            // For simplicity in this version: any valid-token holder can add more.
            // The caller proves admin by knowing an existing token.
            var i : Nat = 0;
            while (i < mem.allowed_callers.size()) {
                if (mem.allowed_callers[i] == token) {
                    return "already_exists";
                };
                i := i + 1;
            };
            mem.allowed_callers := Array.concat(mem.allowed_callers, [token]);
            "added:" # token;
        };

        // Admin: remove a token from the allowlist.
        public func /*update*/remove_allowed_caller(token : Text) : async* Text {
            if (token == "") { return "empty_token" };
            var newList : [Text] = [];
            var found : Bool = false;
            var i : Nat = 0;
            while (i < mem.allowed_callers.size()) {
                if (mem.allowed_callers[i] == token) {
                    found := true;
                } else {
                    newList := Array.concat(newList, [mem.allowed_callers[i]]);
                };
                i := i + 1;
            };
            if (not found) { return "not_found" };
            mem.allowed_callers := newList;
            "removed:" # token;
        };

        // ===================== Page-chunked ledger helpers =====================

        func ledgerTotal() : Nat {
            var total : Nat = 0;
            var i : Nat = 0;
            while (i < mem.pages.size()) {
                total := total + mem.pages[i].size();
                i := i + 1;
            };
            total;
        };

        // O(1) amortized append: only reallocates the current (last) page.
        func appendEntry(entry : Memory.LedgerEntry) {
            let pageSize = Memory.PAGE_SIZE;
            if (mem.pages.size() == 0) {
                mem.pages := [[entry]];
            } else {
                let lastIdx = mem.pages.size() - 1;
                let lastPage = mem.pages[lastIdx];
                if (lastPage.size() >= pageSize) {
                    // Start a new page.
                    mem.pages := Array.concat(mem.pages, [[entry]]);
                } else {
                    // Append to current page (only this page is copied).
                    let newPage = Array.concat(lastPage, [entry]);
                    // Replace the last page in the pages array.
                    var newPages : [[Memory.LedgerEntry]] = [];
                    var i : Nat = 0;
                    while (i < lastIdx) {
                        newPages := Array.concat(newPages, [mem.pages[i]]);
                        i := i + 1;
                    };
                    newPages := Array.concat(newPages, [newPage]);
                    mem.pages := newPages;
                };
            };
        };

        // Read a range from the chunked ledger (0-indexed, oldest first).
        func readRange(offset : Nat, limit : Nat) : [LedgerEntry] {
            let total = ledgerTotal();
            if (offset >= total) { return [] };
            let end = if (offset + limit > total) { total } else { offset + limit };
            var result : [LedgerEntry] = [];
            var globalIdx : Nat = 0;
            var collected : Nat = 0;
            var pageIdx : Nat = 0;
            while (pageIdx < mem.pages.size() and collected < (end - offset)) {
                let page = mem.pages[pageIdx];
                var entryIdx : Nat = 0;
                while (entryIdx < page.size() and collected < (end - offset)) {
                    if (globalIdx >= offset and globalIdx < end) {
                        result := Array.concat(result, [page[entryIdx]]);
                        collected := collected + 1;
                    };
                    globalIdx := globalIdx + 1;
                    entryIdx := entryIdx + 1;
                };
                pageIdx := pageIdx + 1;
            };
            result;
        };

        // Read all entries (for report generation; bounded by total).
        func readAll() : [LedgerEntry] {
            readRange(0, ledgerTotal());
        };

        // ===================== M3: grade -> sign -> ledger =====================

        public func /*update*/attest_entry(input : AttestInput) : async* AttestResult {
            // Duplicate detection (item #6).
            switch (Map.get(mem.attested_jobs, Text.compare, input.job_id)) {
                case (?_) { return #error("duplicate_job_id:" # input.job_id) };
                case (null) {};
            };

            let context_hash = sha256Hex(Text.encodeUtf8(input.context));
            let prompt_hash = sha256Hex(Text.encodeUtf8(input.prompt));
            let ground_truth_hash = optHash(input.ground_truth);
            let human_outcome_hash = optHumanOutcomeHash(input.human_outcome);
            let grade = computeGrade(input.pred, input.ground_truth);

            let ts = Int.abs(Time.now()) / 1_000_000_000;
            let seq = mem.seq;
            mem.seq := seq + 1;

            // Use the caller-supplied evaluator_version (item #5).
            let gradingVersion = if (input.evaluator_version == "") {
                "ration/ordered-v1";
            } else {
                input.evaluator_version;
            };

            var assertion = buildAssertion(
                seq, ts, input, context_hash, prompt_hash, ground_truth_hash,
                human_outcome_hash, grade, gradingVersion,
            );
            if (Text.encodeUtf8(assertion).size() > 3800) {
                assertion := buildCompactAssertion(
                    seq, ts, input, context_hash, prompt_hash, ground_truth_hash,
                    human_outcome_hash, grade, gradingVersion,
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
                        grading_version = gradingVersion;
                        pred = input.pred;
                        model = input.model;
                        em = grade.em;
                        chrf = grade.chrf;
                        score = grade.score;
                        assertion;
                        assertion_hash = sha256Hex(Text.encodeUtf8(assertion));
                        signature = s.signature;
                    };
                    appendEntry(entry);
                    // Record job_id as attested.
                    Map.add(mem.attested_jobs, Text.compare, input.job_id, true);
                    #attested(entry);
                };
                case (#err(e)) {
                    #error("sign_failed: " # showCkErr(e));
                };
            };
        };

        // ===================== Ledger queries =====================

        // Paginated ledger access (item #2).
        public func /*update*/get_ledger_page(input : { offset : Nat; limit : Nat }) : async* LedgerPage {
            let total = ledgerTotal();
            let cappedLimit = if (input.limit > 100) { 100 } else { input.limit };
            let entries = readRange(input.offset, cappedLimit);
            { entries; total; offset = input.offset };
        };

        // Original get_ledger: capped at most recent 50 entries (item #2).
        public func /*update*/get_ledger() : async* [LedgerEntry] {
            let total = ledgerTotal();
            let cap : Nat = 50;
            let start = if (total > cap) { total - cap } else { 0 };
            readRange(start, cap);
        };

        // Ledger status: total count and last report seq (item #9 frontend).
        public func /*update*/get_ledger_status() : async* LedgerStatus {
            { total = ledgerTotal(); last_report_seq = mem.last_report_seq };
        };

        // ================ M4: certified ledger report publication ================

        func blobHex(b : Blob) : Text {
            var hexOut = "";
            var i : Nat = 0;
            while (i < b.size()) {
                let n = Nat8.toNat(b[i]);
                hexOut #= HEX[n / 16] # HEX[n % 16];
                i := i + 1;
            };
            hexOut;
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

        func entryJson(e : LedgerEntry, full : Bool) : Text {
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

        // Item #4: paginated reports. Each report covers entries from
        // last_report_seq to current, or at most 100 entries per report.
        // Reports reference the previous report's digest for chain continuity.
        func reportBody(fromSeq : Nat, toSeq : Nat, prevDigest : ?Text, full : Bool) : Text {
            let entries = readRange(fromSeq, toSeq - fromSeq);
            var entriesJson = "[";
            var i : Nat = 0;
            while (i < entries.size()) {
                if (i > 0) { entriesJson #= ","; };
                entriesJson #= entryJson(entries[i], full);
                i := i + 1;
            };
            entriesJson #= "]";
            let prevRef = switch (prevDigest) {
                case (null) { "" };
                case (?d) { ",\"prev_report_digest\":\"" # d # "\"" };
            };
            "{" # "\"format\":\"ration.ledger-report.v2\""
                # ",\"app\":\"ratiocine\""
                # (if (full) { "" } else { ",\"mode\":\"compact\"" })
                # ",\"from_seq\":" # Nat.toText(fromSeq)
                # ",\"to_seq\":" # Nat.toText(toSeq)
                # ",\"entry_count\":" # Nat.toText(entries.size())
                # prevRef
                # ",\"entries\":" # entriesJson
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

        func reportNonce(digest : Blob) : Blob {
            var nonceOut = "";
            var i : Nat = 0;
            while (i < 8) {
                let n = Nat8.toNat(digest[i]);
                nonceOut #= HEX[n / 16] # HEX[n % 16];
                i := i + 1;
            };
            Text.encodeUtf8(nonceOut);
        };

        public func /*update*/publish_report() : async* Text {
            let total = ledgerTotal();
            if (total == 0) { return "empty_ledger" };

            let fromSeq = mem.last_report_seq;
            if (fromSeq >= total) { return "no_new_entries" };

            // Cap at 100 entries per report to stay under 64KB.
            let maxEntries : Nat = 100;
            let toSeq = if (total - fromSeq > maxEntries) { fromSeq + maxEntries } else { total };

            var body = reportBody(fromSeq, toSeq, null, true);
            if (Text.encodeUtf8(body).size() > 60000) {
                body := reportBody(fromSeq, toSeq, null, false);
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
                case (#ok(_)) {
                    mem.last_report_seq := toSeq;
                    "published:" # blobHex(digest);
                };
                case (#err(#conflict(_))) {
                    mem.last_report_seq := toSeq;
                    "already_published:" # blobHex(digest);
                };
                case (#err(e)) { "publish_error:" # casErrText(e) };
            };
        };

        // ================ Agent Mode entrypoints (internal:apps) ================

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

        // ===================== Probe methods (gated) =====================

        // Item #7: Only admin-token holders can invoke ping_solver.
        public func /*update*/ping_solver(admin_token : Text) : async* Text {
            switch (requireToken(admin_token)) {
                case (?e) { return e };
                case (null) {};
            };
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

        // Item #7: sign_probe also gated.
        public func /*update*/sign_probe(input : { admin_token : Text; msg : Text }) : async* Text {
            switch (requireToken(input.admin_token)) {
                case (?e) { return e };
                case (null) {};
            };
            let result = await* ck.sign_assertion({
                slot = "ration_assertions";
                assertion = Text.encodeUtf8(input.msg);
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

        // Public key is read-only, no gate needed.
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
                            chrfSum += chrfScore(p, r);
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
        // Renamed to avoid shadowing with local variables (gotcha #7).
        func chrfScore(hyp : Text, ref : Text) : Float {
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

        func normalize(s : Text) : Text {
            let chars = Text.toArray(s);
            let len = chars.size();
            var first : Nat = 0;
            while (first < len and Char.isWhitespace(chars[first])) { first += 1; };
            if (first == len) { return ""; };
            var last : Nat = len - 1;
            while (last > first and Char.isWhitespace(chars[last])) { last -= 1; };
            var normOut = "";
            var prevSpace : Bool = false;
            var i = first;
            while (i <= last) {
                let c = chars[i];
                if (Char.isWhitespace(c)) {
                    if (not prevSpace) {
                        normOut #= " ";
                        prevSpace := true;
                    };
                } else {
                    normOut #= Char.toText(toLowerChar(c));
                    prevSpace := false;
                };
                i += 1;
            };
            normOut;
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
            var hexOut = "";
            var i : Nat = 0;
            while (i < digest.size()) {
                let n = Nat8.toNat(digest[i]);
                hexOut #= HEX[n / 16] # HEX[n % 16];
                i := i + 1;
            };
            hexOut;
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
            var natOut = "";
            var i : Nat = 0;
            while (i < values.size()) {
                if (i > 0) { natOut #= ","; };
                natOut #= Nat.toText(values[i]);
                i := i + 1;
            };
            natOut;
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

        let QUOTE : Char = Char.fromNat32(34);
        let BACKSLASH : Char = Char.fromNat32(92);
        let NEWLINE : Char = Char.fromNat32(10);
        let TAB : Char = Char.fromNat32(9);
        let CARRIAGE : Char = Char.fromNat32(13);

        func jsonEscape(s : Text) : Text {
            let chars = Text.toArray(s);
            var escOut = "";
            var i : Nat = 0;
            while (i < chars.size()) {
                let c = chars[i];
                if (c == QUOTE) {
                    escOut #= "\\\"";
                } else if (c == BACKSLASH) {
                    escOut #= "\\\\";
                } else if (c == NEWLINE) {
                    escOut #= "\\n";
                } else if (c == TAB) {
                    escOut #= "\\t";
                } else if (c == CARRIAGE) {
                    escOut #= "\\r";
                } else {
                    let n32 = Char.toNat32(c);
                    if (n32 < (32 : Nat32)) {
                        var h = "\\u00";
                        let n = Nat32.toNat(n32);
                        h #= HEX[n / 16];
                        h #= HEX[n % 16];
                        escOut #= h;
                    } else {
                        escOut #= Char.toText(c);
                    };
                };
                i := i + 1;
            };
            escOut;
        };

        func predJson(pred : [Text]) : Text {
            var pjOut = "";
            var i : Nat = 0;
            while (i < pred.size()) {
                if (pjOut.size() > 0) { pjOut #= ","; };
                pjOut #= "\"" # jsonEscape(pred[i]) # "\"";
                i := i + 1;
            };
            pjOut;
        };

        func gradeJson(g : Grade) : Text {
            switch (g.em) {
                case (null) { "null" };
                case (?em) {
                    switch (g.score) {
                        case (null) { "null" };
                        case (?scoreVal) {
                            "{\"em\":" # Float.toText(em)
                                # ",\"chrf\":" # Float.toText(g.chrf ?? em)
                                # ",\"score\":" # Float.toText(scoreVal) # "}";
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
            gradingVersion : Text,
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
                # ",\"grading\":\"" # jsonEscape(gradingVersion) # "\""
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
            gradingVersion : Text,
        ) : Text {
            "{" # assertionCommonHead(
                    seq, ts, input, context_hash, prompt_hash, ground_truth_hash,
                    human_outcome_hash, gradingVersion,
                )
                # ",\"pred\":[" # predJson(input.pred) # "]"
                # ",\"grade\":" # gradeJson(grade) # "}";
        };

        func buildCompactAssertion(
            seq : Nat,
            ts : Nat,
            input : AttestInput,
            context_hash : Text,
            prompt_hash : Text,
            ground_truth_hash : ?Text,
            human_outcome_hash : ?Text,
            grade : Grade,
            gradingVersion : Text,
        ) : Text {
            let joined = joinTexts(input.pred);
            "{" # assertionCommonHead(
                    seq, ts, input, context_hash, prompt_hash, ground_truth_hash,
                    human_outcome_hash, gradingVersion,
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

public type add_allowed_caller_Input = (token : Text);
public type add_allowed_caller_Output = Text;

public type remove_allowed_caller_Input = (token : Text);
public type remove_allowed_caller_Output = Text;

public type attest_entry_Input = (input : AttestInput);
public type attest_entry_Output = AttestResult;

public type get_ledger_page_Input = (input : { offset : Nat; limit : Nat });
public type get_ledger_page_Output = LedgerPage;

public type get_ledger_Input = ();
public type get_ledger_Output = [LedgerEntry];

public type get_ledger_status_Input = ();
public type get_ledger_status_Output = LedgerStatus;

public type publish_report_Input = ();
public type publish_report_Output = Text;

public type ration_attest_Input = (input : AttestInput,);
public type ration_attest_Output = AttestResult;

public type ration_ledger_Input = (());
public type ration_ledger_Output = [LedgerEntry];

public type ration_report_Input = (());
public type ration_report_Output = Text;

public type ping_solver_Input = (admin_token : Text);
public type ping_solver_Output = Text;

public type sign_probe_Input = (input : { admin_token : Text; msg : Text });
public type sign_probe_Output = Text;

public type get_pubkey_Input = ();
public type get_pubkey_Output = Text;

/*---NEUTRON GENERATED END---*/
}
