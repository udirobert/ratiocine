import V1 "./v1";
import V2 "./v2";

module {
    // v1 had no ledger; start an empty logbook.
    public func migrate(old : V1.Mem) : V2.Mem {
        {
            var name = old.name;
            var seq = old.seq;
            var ledger : [V2.LedgerEntry] = [];
        };
    };
};
