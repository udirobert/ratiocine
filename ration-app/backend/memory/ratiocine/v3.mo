// Persistent schema v3: versioned evidence commitments for cross-product
// human-versus-AI comparisons. Keep immutable after release.
import Float "mo:core/Float";

module {
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
        em : ?Float.Float;
        chrf : ?Float.Float;
        score : ?Float.Float;
        assertion : Text;
        assertion_hash : Text;
        signature : Blob;
    };

    public type Mem = {
        var name : Text;
        var seq : Nat;
        var ledger : [LedgerEntry];
    };

    public func init() : Mem {
        { var name = "Ration"; var seq = 0; var ledger = [] };
    };
};
