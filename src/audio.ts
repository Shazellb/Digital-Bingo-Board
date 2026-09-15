import { columnOf } from './engine/draw';

const SPOKEN_COLUMNS = {
  B: 'Bee',
  I: 'Eye',
  N: 'En',
  G: 'G',
  O: 'Oh',
} as const;

export function announcementParts(n: number): [letter: string, number: string] {
  return [SPOKEN_COLUMNS[columnOf(n)], String(n)];
}

export function selectEnglishVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return voices.find((voice) => voice.lang.toLowerCase() === 'en-us')
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('en-us'))
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('en'))
    ?? null;
}

let englishVoice: SpeechSynthesisVoice | null = null;

function refreshEnglishVoice(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  englishVoice = selectEnglishVoice(window.speechSynthesis.getVoices());
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshEnglishVoice();
  window.speechSynthesis.addEventListener('voiceschanged', refreshEnglishVoice);
}

function speakParts(parts: string[]): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    refreshEnglishVoice();
    for (const part of parts) {
      const utter = new SpeechSynthesisUtterance(part);
      if (englishVoice) utter.voice = englishVoice;
      utter.lang = englishVoice?.lang || 'en-US';
      utter.rate = 1.1;
      window.speechSynthesis.speak(utter);
    }
  } catch (err) {
    console.error('[bingo] speech synthesis failed', err);
  }
}

export function speak(text: string): void {
  speakParts([text]);
}

export function speakCall(n: number): void {
  speakParts(announcementParts(n));
}

export function speakTest(): void {
  speak('Digital Bingo Board voice test.');
}

let audioCtx: AudioContext | null = null;
let audienceBufferPromise: Promise<AudioBuffer> | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function loadAudienceCheer(ctx: AudioContext): Promise<AudioBuffer> {
  if (!audienceBufferPromise) {
    audienceBufferPromise = fetch(`${import.meta.env.BASE_URL}audio/audience-cheer.mp3`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .catch((error) => {
        audienceBufferPromise = null;
        throw error;
      });
  }
  return audienceBufferPromise;
}

/** Call from a user gesture on the Display so later remote-triggered audio is allowed. */
export async function enableAudio(): Promise<boolean> {
  const ctx = getAudioCtx();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    if ('speechSynthesis' in window) window.speechSynthesis.resume();
    void loadAudienceCheer(ctx).catch((error) => console.error('[bingo] audience cheer preload failed', error));
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

export function playAudienceApplause(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void loadAudienceCheer(ctx).then((buffer) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    source.connect(gain).connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + 6);
  }).catch((error) => console.error('[bingo] audience applause failed', error));
}
