import { columnOf } from './engine/draw';

export function announcementText(n: number): string {
  return `${columnOf(n)}. ${n}`;
}

export function speak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.error('[bingo] speech synthesis failed', err);
  }
}

export function speakCall(n: number): void {
  speak(announcementText(n));
}

export function speakTest(): void {
  speak('Digital Bingo Board voice test.');
}

let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

/** Call from a user gesture on the Display so later remote-triggered audio is allowed. */
export async function enableAudio(): Promise<boolean> {
  const ctx = getAudioCtx();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    if ('speechSynthesis' in window) window.speechSynthesis.resume();
    return ctx.state === 'running';
  } catch (err) {
    console.error('[bingo] audio enable failed', err);
    return false;
  }
}

export function playDrawSound(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (err) {
    console.error('[bingo] draw sound failed', err);
  }
}

/** A layered, three-second crowd-applause effect synthesized locally with Web Audio. */
export function playAudienceApplause(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const duration = 3.2;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        const time = i / ctx.sampleRate;
        const crowdEnvelope = Math.min(1, time * 4) * Math.pow(Math.max(0, 1 - time / duration), 0.45);
        data[i] = (Math.random() * 2 - 1) * crowdEnvelope * 0.12;
      }
      for (let clap = 0; clap < 70; clap++) {
        const start = Math.floor(Math.random() * bufferSize);
        const clapLength = Math.min(Math.floor(ctx.sampleRate * 0.04), bufferSize - start);
        for (let offset = 0; offset < clapLength; offset++) {
          const time = (start + offset) / ctx.sampleRate;
          const crowdEnvelope = Math.min(1, time * 4) * Math.pow(Math.max(0, 1 - time / duration), 0.45);
          data[start + offset] += (Math.random() * 2 - 1) * Math.exp(-offset / ctx.sampleRate * 105) * crowdEnvelope * 0.9;
        }
      }
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1450;
    bandpass.Q.value = 0.55;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.85, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    noise.connect(bandpass).connect(gain).connect(ctx.destination);
    noise.start();
  } catch (err) {
    console.error('[bingo] audience applause failed', err);
  }
}
