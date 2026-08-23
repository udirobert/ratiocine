"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface AudioMomentProps {
  audioSrc: string;
  language: string;
  transcript: string; // what's being spoken
  autoPlay?: boolean;
}

export const AudioMoment = ({
  audioSrc,
  language,
  transcript,
  autoPlay = true,
}: AudioMomentProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    const audio = new Audio(audioSrc);
    audio.volume = 0.7;
    audioRef.current = audio;

    audio.addEventListener("play", () => setPlaying(true));
    audio.addEventListener("ended", () => {
      setPlaying(false);
      setHasPlayed(true);
    });
    audio.addEventListener("pause", () => setPlaying(false));

    if (autoPlay) {
      // Small delay to let the success animation settle
      const t = setTimeout(() => {
        audio.play().catch(() => {
          // Autoplay blocked — user will need to tap
        });
      }, 1800);
      return () => {
        clearTimeout(t);
        audio.pause();
        audio.src = "";
      };
    }

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [audioSrc, autoPlay]);

  const handlePlay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.6, duration: 0.4 }}
      className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 flex items-center gap-3"
    >
      {/* Play button */}
      <button
        onClick={handlePlay}
        className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
          playing
            ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
            : "border-white/20 bg-white/[0.04] text-white/60 hover:text-white/80 hover:border-white/30"
        }`}
        aria-label={playing ? "Playing" : "Play audio"}
      >
        {playing ? (
          // Sound waves icon
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-pulse">
            <rect x="1" y="4" width="2" height="6" rx="1" fill="currentColor" />
            <rect x="4.5" y="2" width="2" height="10" rx="1" fill="currentColor" />
            <rect x="8" y="3" width="2" height="8" rx="1" fill="currentColor" />
            <rect x="11.5" y="5" width="2" height="4" rx="1" fill="currentColor" />
          </svg>
        ) : (
          // Play triangle
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2.5 1.5l8 4.5-8 4.5V1.5z" />
          </svg>
        )}
      </button>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-white/40 font-mono uppercase tracking-wider">
          Hear {language}
        </p>
        <p className="text-sm text-white/70 font-mono truncate">
          {transcript}
        </p>
      </div>

      {/* Status */}
      {hasPlayed && !playing && (
        <span className="text-[10px] text-white/25 shrink-0">tap to replay</span>
      )}
    </motion.div>
  );
};
