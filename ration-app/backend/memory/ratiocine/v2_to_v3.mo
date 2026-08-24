import V2 "./v2";
import V3 "./v3";

module {
    // Preserve every v2 receipt while making its previously-unbound evidence
    // explicit as absent. New v3 attestations populate these commitments.
    public func migrate(old : V2.Mem) : V3.Mem {
        var ledger : [V3.LedgerEntry] = [];
        var i : Nat = 0;
        while (i < old.ledger.size()) {
            let entry = old.ledger[i];
            let migrated : V3.LedgerEntry = {
                seq = entry.seq;
                ts = entry.ts;
                job_id = entry.job_id;
                problem_id = entry.problem_id;
                context_hash = entry.context_hash;
                prompt = entry.prompt;
                prompt_hash = "";
                ground_truth_hash = null;
                case_version = null;
                case_hash = null;
                human_outcome_hash = null;
                grading_version = "ration/ordered-v0-unbound";
                pred = entry.pred;
                model = entry.model;
                em = entry.em;
                chrf = entry.chrf;
                score = entry.score;
                assertion = entry.assertion;
                assertion_hash = entry.assertion_hash;
                signature = entry.signature;
            };
            ledger := Array.concat(ledger, [migrated]);
            i := i + 1;
        };
        {
            var name = old.name;
            var seq = old.seq;
            var ledger = ledger;
        };
    };
};
