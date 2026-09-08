'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);

  useEffect(() => {
    // Check localStorage for existing consent decision
    const consent = localStorage.getItem('ration-research-consent');
    if (consent === null) {
      // Show banner after 5s delay (don't interrupt game entry)
      const timer = setTimeout(() => setVisible(true), 5000);
      return () => clearTimeout(timer);
    } else {
      setHasConsented(consent === 'true');
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('ration-research-consent', 'true');
    setHasConsented(true);
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('ration-research-consent', 'false');
    setHasConsented(false);
    setVisible(false);
  };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50"
          >
            <div className="bg-black/90 backdrop-blur-lg border border-white/20 rounded-lg p-4 shadow-2xl">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl" role="img" aria-label="microscope">🔬</span>
                <div>
                  <h3 className="font-bold text-sm mb-1 text-white">Help improve linguistics research</h3>
                  <p className="text-xs text-white/70 leading-relaxed">
                    We'd like to collect anonymized data about how you solve puzzles (tile placements,
                    study time, attempts) to contribute to translation benchmarks and IOL research.
                    No personal data is collected.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAccept}
                  className="flex-1 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20
                           rounded border border-white/30 transition text-white"
                >
                  I'm in
                </button>
                <button
                  onClick={handleDecline}
                  className="px-3 py-2 text-xs text-white/60 hover:text-white/80 transition"
                >
                  No thanks
                </button>
              </div>
              <a
                href="/privacy"
                className="block mt-2 text-xs text-white/50 hover:text-white/70 underline"
              >
                Learn more about data use
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optional: Research badge when consented */}
      {hasConsented && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed top-20 right-4 text-xs px-2 py-1 bg-white/5 border border-white/20 rounded-full text-white/60 backdrop-blur-sm z-40"
        >
          <span className="mr-1" role="img" aria-label="microscope">🔬</span>
          Contributing to research
        </motion.div>
      )}
    </>
  );
}
