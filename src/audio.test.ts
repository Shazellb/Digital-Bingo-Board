import { describe, expect, it } from 'vitest';
import { announcementParts, selectEnglishVoice } from './audio';

describe('announcementParts', () => {
  it.each([
    [7, ['Bee', '7']],
    [22, ['Eye', '22']],
    [37, ['En', '37']],
    [52, ['G', '52']],
    [68, ['Oh', '68']],
  ] as const)('speaks ball %i as a separate letter and number', (ball, expected) => {
    expect(announcementParts(ball)).toEqual(expected);
  });
});

function voice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, default: false, localService: true, voiceURI: name };
}

describe('selectEnglishVoice', () => {
  it('prefers an en-US voice over other English and default-language voices', () => {
    const voices = [voice('French', 'fr-FR'), voice('British', 'en-GB'), voice('American', 'en-US')];

    expect(selectEnglishVoice(voices)?.name).toBe('American');
  });

  it('falls back to another English voice and never selects a non-English voice', () => {
    expect(selectEnglishVoice([voice('French', 'fr-FR'), voice('British', 'en-GB')])?.name).toBe('British');
    expect(selectEnglishVoice([voice('French', 'fr-FR')])).toBeNull();
  });
});
