// Persistent schema v4: page-chunked ledger for O(1) append, caller allowlist,
// job dedup set, and report tracking. Keep immutable after release.
import Float "mo:core/Float";
import Map "mo:core/Map";
import Text "mo:core/Text";

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

    // Page-chunked ledger: each page holds up to PAGE_SIZE entries.
    // Only the last page is reallocated on append. Earlier pages are frozen.
    public let PAGE_SIZE : Nat = 64;

    public type Mem = {
        var name : Text;
        var seq : Nat;
        // Chunked pages: pages[0] is oldest, pages[len-1] is current.
        var pages : [[LedgerEntry]];
        // Authorized callers for mutating methods (principals as text).
        var allowed_callers : [Text];
        // Set of attested job_ids to prevent duplicate signing.
        var attested_jobs : Map.Map<Text, Bool>;
        // Seq of the last published report (for delta indicator).
        var last_report_seq : Nat;
    };

    public func init() : Mem {
        {
            var name = "Ration";
            var seq = 0;
            var pages = [];
            var allowed_callers = [];
            var attested_jobs = Map.empty();
            var last_report_seq = 0;
        };
    };
};
