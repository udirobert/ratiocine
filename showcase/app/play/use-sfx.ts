"use client";

import { useCallback, useRef } from "react";

// Micro-sound effects via Web Audio API oscillator synthesis.
// No audio files — pure waveform generation, ~50ms per sound.

export const useSfx = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(false);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  // Enable on first user interaction
  const enable = useCallback(() => {
    enabledRef.current = true;
    getCtx();
  }, [getCtx]);

  // Soft click — tile select
  const click = useCallback(() => {
    if (!enabledRef.current) return;
    const ac = getCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2200, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1600, ac.currentTime + 0.03);
    gain.gain.setValueAtTime(0.04, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04);
    osc.connect(gain).connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.04);
  }, [getCtx]);

  // Snap — tile placed in slot
  const snap = useCallback(() => {
    if (!enabledRef.current) return;
    const ac = getCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(800, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ac.currentTime + 0.02);
    gain.gain.setValueAtTime(0.06, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);
    osc.connect(gain).connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.06);
  }, [getCtx]);

  // Thud — wrong answer
  const thud = useCallback(() => {
    if (!enabledRef.current) return;
    const ac = getCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.12);
    gain.gain.setValueAtTime(0.07, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
    osc.connect(gain).connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.15);
  }, [getCtx]);

  // Chime — correct answer (three ascending notes)
  const chime = useCallback(() => {
    if (!enabledRef.current) return;
    const ac = getCtx();
    if (!ac) return;
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ac.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }, [getCtx]);

  // Pop — tile removed from slot (short high blip)
  const pop = useCallback(() => {
    if (!enabledRef.current) return;
    const ac = getCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.06);
    gain.gain.setValueAtTime(0.05, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);
    osc.connect(gain).connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.07);
  }, [getCtx]);

  return { enable, click, snap, thud, chime, pop };
};
