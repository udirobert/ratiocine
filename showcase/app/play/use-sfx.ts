"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

// Micro-sound effects via Web Audio API oscillator synthesis.
// No audio files — pure waveform generation, ~50ms per sound.

const MUTE_KEY = "ration-sfx-muted";

// Per-puzzle ambient pad root frequencies (Hz, ~1st octave) — a subliminal
// "room tone" for each world, detuned pair + fifth, beating very slowly.
export const AMBIENT_FREQ: Record<string, number> = {
  "apurina-verb-agreement": 55.0,   // A1 — rainforest floor
  "swahili-person-tense": 49.0,     // G1 — coastal wind
  "turkish-vowel-harmony": 61.74,   // B1 — bazaar hum
  "quechua-person-endings": 51.91,  // G#1 — thin mountain air
  "nahuatl-both-ends": 58.27,       // A#1 — temple stone
  "esperanto-tense": 57.0,          // A#1-ish — congress hall
  "indonesian-plurals": 53.0,       // F1 — archipelago surf
  "finnish-harmony": 46.25,         // F#1 — frozen lake
  "maori-pronouns": 50.0,           // G1-ish — southern ocean
  "zulu-noun-class": 59.0,          // B1-ish — highveld drum
};

interface AmbientNodes {
  ctx: AudioContext;
  oscs: OscillatorNode[];
  lfo: OscillatorNode;
  gain: GainNode;
}

export const useSfx = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<AudioBuffer | null>(null);
  const ambientRef = useRef<AmbientNodes | null>(null);
  const ambientFreqRef = useRef(55);
  const enabledRef = useRef(false);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const mutedRef = useRef(muted);

  // Respect the OS / MotionConfig reduced-motion preference for sound as well.
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);

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

  const getNoise = useCallback((ac: AudioContext): AudioBuffer => {
    if (!noiseRef.current) {
      const len = Math.floor(ac.sampleRate * 0.5);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      noiseRef.current = buf;
    }
    return noiseRef.current;
  }, []);

  // ── Ambient pad — a barely-there drone that starts after first gesture ──

  const stopAmbient = useCallback(() => {
    const a = ambientRef.current;
    if (!a) return;
    ambientRef.current = null;
    try {
      const t = a.ctx.currentTime;
      a.gain.gain.cancelScheduledValues(t);
      a.gain.gain.setTargetAtTime(0.0001, t, 0.35);
      a.oscs.forEach((o) => o.stop(t + 1.4));
      a.lfo.stop(t + 1.4);
    } catch {}
  }, []);

  // Keep the reduced-motion ref in sync and stop sound when the preference flips.
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    if (reducedMotion) stopAmbient();
  }, [reducedMotion, stopAmbient]);

  const startAmbient = useCallback(() => {
    if (!enabledRef.current || mutedRef.current || reducedMotionRef.current || ambientRef.current) return;
    const ac = getCtx();
    if (!ac) return;
    const f = ambientFreqRef.current;
    const t = ac.currentTime;

    const gain = ac.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.016, t, 1.4); // fade in over ~4s

    const o1 = ac.createOscillator();
    o1.type = "sine";
    o1.frequency.value = f;
    const o2 = ac.createOscillator();
    o2.type = "sine";
    o2.frequency.value = f * 1.007; // ~12-cent beat — the air shimmers
    const o3 = ac.createOscillator();
    o3.type = "triangle";
    o3.frequency.value = f * 1.5; // quiet fifth
    const g3 = ac.createGain();
    g3.gain.value = 0.3;

    // Slow breathing on the master gain
    const lfo = ac.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 0.005;
    lfo.connect(lfoGain).connect(gain.gain);

    o1.connect(gain);
    o2.connect(gain);
    o3.connect(g3).connect(gain);
    gain.connect(ac.destination);
    o1.start(t);
    o2.start(t);
    o3.start(t);
    lfo.start(t);

    ambientRef.current = { ctx: ac, oscs: [o1, o2, o3], lfo, gain };
  }, [getCtx]);

  const setAmbientFreq = useCallback((f: number) => {
    ambientFreqRef.current = f;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      if (next) stopAmbient();
      else startAmbient();
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, [startAmbient, stopAmbient]);

  // Enable on first user interaction
  const enable = useCallback(() => {
    enabledRef.current = true;
    if (!mutedRef.current) {
      getCtx();
      startAmbient();
    }
  }, [getCtx, startAmbient]);

  // Soft click — tile select
  const click = useCallback(() => {
    if (!enabledRef.current || mutedRef.current || reducedMotionRef.current) return;
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
    if (!enabledRef.current || mutedRef.current || reducedMotionRef.current) return;
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
    if (!enabledRef.current || mutedRef.current || reducedMotionRef.current) return;
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
    if (!enabledRef.current || mutedRef.current || reducedMotionRef.current) return;
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
    if (!enabledRef.current || mutedRef.current || reducedMotionRef.current) return;
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

  // Stamp — wax-seal thud: low body + paper-contact noise
  const stamp = useCallback(() => {
    if (!enabledRef.current || mutedRef.current || reducedMotionRef.current) return;
    const ac = getCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.16);
    og.gain.setValueAtTime(0.09, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(og).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.2);
    const src = ac.createBufferSource();
    src.buffer = getNoise(ac);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.05, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    src.connect(lp).connect(ng).connect(ac.destination);
    src.start(t);
    src.stop(t + 0.08);
  }, [getCtx, getNoise]);

  // Page — evidence drawer opens: soft paper swish
  const page = useCallback(() => {
    if (!enabledRef.current || mutedRef.current || reducedMotionRef.current) return;
    const ac = getCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = getNoise(ac);
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.18);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    src.connect(bp).connect(g).connect(ac.destination);
    src.start(t);
    src.stop(t + 0.26);
  }, [getCtx, getNoise]);

  // Whoosh — phase/query transition: low air sweep
  const whoosh = useCallback(() => {
    if (!enabledRef.current || mutedRef.current || reducedMotionRef.current) return;
    const ac = getCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = getNoise(ac);
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(240, t);
    bp.frequency.exponentialRampToValueAtTime(950, t + 0.22);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.024, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(bp).connect(g).connect(ac.destination);
    src.start(t);
    src.stop(t + 0.32);
  }, [getCtx, getNoise]);

  return {
    enable,
    click,
    snap,
    thud,
    chime,
    pop,
    stamp,
    page,
    whoosh,
    setAmbientFreq,
    startAmbient,
    stopAmbient,
    muted,
    toggleMute,
  };
};
