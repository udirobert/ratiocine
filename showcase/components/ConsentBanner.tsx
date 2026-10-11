'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { loadProgress } from '../app/play/puzzle-data';

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);
  const [hasSolved, setHasSolved] = useState(false);

  useEffect(() => {
    const solved = () => loadProgress().puzzlesSolved >= 1;
    if (solved()) {
      setHasSolved(true);
      return;
    }
    const onSaved = () => {
      if (solved()) setHasSolved(true);
    };
    window.addEventListener('ratiocine:progress-saved', onSaved);
    return () => window.removeEventListener('ratiocine:progress-saved', onSaved);
  }, []);

  useEffect(() => {
    if (!hasSolved) return;
    // Check localStorage for existing consent decision
    let consent: string | null = null;
    try {
      consent = localStorage.getItem('ration-research-consent');
    } catch {
      return;
    }
    if (consent === null) {
      // Show banner after 10s delay (don't interrupt game entry)
      const timer = setTimeout(() => setVisible(true), 10000);
      return () => clearTimeout(timer);
    } else {
      setHasConsented(consent === 'true');
    }
  }, [hasSolved]);

  const handleAccept = () => {
    localStorage.setItem('ration-research-consent', 'true');
    setHasConsented(true);
    setVisible(false);
    // Lets an in-progress session anchor a session_start trace — consent
    // arrives mid-puzzle, after mount.
    window.dispatchEvent(new CustomEvent('ratiocine:consent'));
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
            <div className="bg-black/90 backdrop-blur-lg border border-white/20 rounded-lg p-3 md:p-4 shadow-2xl">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-lg md:text-2xl" role="img" aria-label="microscope">🔬</span>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm mb-1 text-white">Help improve linguistics research</h3>
                  <p className="md:hidden text-xs text-white/70 leading-relaxed">
                    Share anonymized solve data? No personal data is collected.
                  </p>
                  <p className="hidden md:block text-xs text-white/70 leading-relaxed">
                    We'd like to collect anonymized data about how you solve puzzles (tile placements,
                    study time, attempts) to contribute to translation benchmarks and IOL research.
                    No personal data is collected.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAccept}
                  className="flex-1 px-3 py-2 min-h-[44px] text-xs font-medium bg-white/10 hover:bg-white/20
                           rounded border border-white/30 transition text-white"
                >
                  I'm in
                </button>
                <button
                  onClick={handleDecline}
                  className="px-3 py-2 min-h-[44px] text-xs text-white/60 hover:text-white/80 transition"
                >
                  No thanks
                </button>
              </div>
              <a
                href="/privacy"
                className="block mt-2 text-xs text-white/70 hover:text-white underline"
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
