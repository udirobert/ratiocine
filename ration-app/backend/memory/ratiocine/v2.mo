// Persistent schema: keep this file immutable after release. Package imports are
// allowed; relative imports are forbidden so app-local types cannot drift.
import Float "mo:core/Float";

module {
    // A single certified record in the reasoning logbook.
    public type LedgerEntry = {
        seq : Nat;
        ts : Int; // unix seconds
        job_id : Text;
        problem_id : Text;
        context_hash : Text; // sha-256 hex of the problem context
        prompt : Text;
        pred : [Text];
        model : Text;
        em : ?Float.Float; // exact-match rate (null when no ground truth)
        chrf : ?Float.Float; // character n-gram F score (null when no ground truth)
        score : ?Float.Float; // sqrt(em * chrf), the competition metric
        assertion : Text; // the exact string that was chain-key signed
        assertion_hash : Text; // sha-256 hex of the assertion
        signature : Blob; // chain-key signature over assertion_hash
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
