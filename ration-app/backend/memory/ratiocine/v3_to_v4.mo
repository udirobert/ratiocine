import Array "mo:core/Array";
import Map "mo:core/Map";
import Text "mo:core/Text";
import V3 "./v3";
import V4 "./v4";

module {
    // Migrate flat ledger array into page-chunked structure.
    // Existing entries are split into pages of PAGE_SIZE.
    // Caller allowlist starts empty — first attest_entry caller is auto-enrolled
    // as bootstrap admin (see main.mo bootstrap logic).
    public func migrate(old : V3.Mem) : V4.Mem {
        let total = old.ledger.size();
        let pageSize = V4.PAGE_SIZE;
        var pages : [[V4.LedgerEntry]] = [];

        var offset : Nat = 0;
        while (offset < total) {
            let remaining = total - offset;
            let count = if (remaining < pageSize) { remaining } else { pageSize };
            var page : [V4.LedgerEntry] = [];
            var i : Nat = 0;
            while (i < count) {
                let entry = old.ledger[offset + i];
                let migrated : V4.LedgerEntry = {
                    seq = entry.seq;
                    ts = entry.ts;
                    job_id = entry.job_id;
                    problem_id = entry.problem_id;
                    context_hash = entry.context_hash;
                    prompt = entry.prompt;
                    prompt_hash = entry.prompt_hash;
                    ground_truth_hash = entry.ground_truth_hash;
                    case_version = entry.case_version;
                    case_hash = entry.case_hash;
                    human_outcome_hash = entry.human_outcome_hash;
                    grading_version = entry.grading_version;
                    pred = entry.pred;
                    model = entry.model;
                    em = entry.em;
                    chrf = entry.chrf;
                    score = entry.score;
                    assertion = entry.assertion;
                    assertion_hash = entry.assertion_hash;
                    signature = entry.signature;
                };
                page := Array.concat(page, [migrated]);
                i := i + 1;
            };
            pages := Array.concat(pages, [page]);
            offset := offset + count;
        };

        // Rebuild attested_jobs from existing entries.
        var jobs : Map.Map<Text, Bool> = Map.empty();
        var j : Nat = 0;
        while (j < total) {
            Map.add(jobs, Text.compare, old.ledger[j].job_id, true);
            j := j + 1;
        };

        {
            var name = old.name;
            var seq = old.seq;
            var pages = pages;
            var allowed_callers = [];
            var attested_jobs = jobs;
            var last_report_seq = 0;
        };
    };
};
