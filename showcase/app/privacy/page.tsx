import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy & Data Use",
  description:
    "How we collect and use anonymized solver traces for linguistics research.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0c10] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/play"
          className="inline-block mb-8 text-sm text-white/60 hover:text-white/80 transition"
        >
          ← Back to game
        </Link>

        <h1 className="text-3xl font-bold mb-6">Privacy & Data Use</h1>

        <section className="mb-8 space-y-3">
          <h2 className="text-xl font-semibold mb-3">
            What We Collect (If You Opt In)
          </h2>
          <p className="text-white/80 leading-relaxed">
            When you enable "Research Data Sharing" in the game, we collect
            anonymized solver traces:
          </p>
          <ul className="list-disc ml-6 space-y-2 text-sm text-white/70">
            <li>Puzzle ID and query index</li>
            <li>Tile placements (morpheme selections)</li>
            <li>Study time, solve time, attempts</li>
            <li>Forfeit decisions and revealed answers</li>
            <li>Grading results (correct/wrong/partial)</li>
            <li>AI verdict comparison (human score vs model score)</li>
          </ul>
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="text-xl font-semibold mb-3">
            What We DO NOT Collect
          </h2>
          <ul className="list-disc ml-6 space-y-2 text-sm text-white/70">
            <li>No IP addresses</li>
            <li>No device fingerprints</li>
            <li>No cookies (beyond localStorage consent flag)</li>
            <li>No personally identifiable information (PII)</li>
            <li>No cross-site tracking</li>
            <li>No email addresses or account information</li>
          </ul>
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="text-xl font-semibold mb-3">How We Use This Data</h2>
          <p className="text-white/80 leading-relaxed mb-2">
            Anonymized solver traces are used for:
          </p>
          <ul className="list-disc ml-6 space-y-2 text-sm text-white/70">
            <li>
              Contributing to machine translation benchmarks (e.g., Last
              Translation Benchmark V2)
            </li>
            <li>
              Analyzing human reasoning strategies for linguistics research
            </li>
            <li>
              Improving the game's puzzle design and difficulty calibration
            </li>
            <li>Publishing aggregate statistics in research papers</li>
          </ul>
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="text-xl font-semibold mb-3">Data Retention</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            Traces are stored for up to 1 year or until research publication
            (whichever comes first). After publication, raw traces are deleted
            and only aggregate statistics are retained.
          </p>
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
          <ul className="list-disc ml-6 space-y-2 text-sm text-white/70">
            <li>Opt in or out at any time via the game (consent banner)</li>
            <li>
              No penalty for declining — the game works identically either way
            </li>
            <li>
              Request deletion of your traces (contact us with your session ID
              hash, shown in browser console)
            </li>
            <li>
              Data is anonymized at collection time — we cannot identify
              individual users from traces
            </li>
          </ul>
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="text-xl font-semibold mb-3">GDPR Compliance</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            Because we collect NO personally identifiable information (not even
            hashed emails or persistent user IDs), we are exempt from most GDPR
            requirements. The consent banner is provided as a courtesy to inform
            users about our research data collection, not as a legal
            requirement. Session IDs are ephemeral (rotate per browser session)
            and double-hashed server-side with salt.
          </p>
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="text-xl font-semibold mb-3">Research Publications</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            Aggregated data from this study may be published in:
          </p>
          <ul className="list-disc ml-6 space-y-2 text-sm text-white/70 mt-2">
            <li>
              <strong>Last Translation Benchmark V2</strong> — a crowdsourced
              benchmark of hard-to-translate examples that break SOTA models (
              <a
                href="https://arxiv.org/abs/2609.04173"
                className="text-white/90 underline hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                paper
              </a>
              ,{" "}
              <a
                href="https://huggingface.co/datasets/zouhar/last-translation-benchmark"
                className="text-white/90 underline hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                dataset
              </a>
              )
            </li>
            <li>
              <strong>IOL-AI Technical Reports</strong> — baseline approaches
              for International Linguistics Olympiad AI competitions
            </li>
            <li>
              <strong>Academic workshops</strong> — ACL, EMNLP, or other
              NLP/linguistics venues
            </li>
          </ul>
          <p className="text-sm text-white/70 leading-relaxed mt-3">
            All publications use only aggregate statistics. Individual solver
            traces are never published or shared outside the research team.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Contact</h2>
          <p className="text-sm text-white/70">
            Questions about data use or privacy?{" "}
            <a
              href="https://github.com/udirobert/ratiocine/issues"
              className="text-white/90 underline hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open a GitHub issue
            </a>{" "}
            or contact the project maintainer via the repository.
          </p>
        </section>

        <div className="mt-12 pt-8 border-t border-white/10 text-xs text-white/50">
          Last updated: September 7, 2026
        </div>
      </div>
    </div>
  );
}
