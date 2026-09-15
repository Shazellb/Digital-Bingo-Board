import { describe, expect, it } from 'vitest';
import { createSession, isPatternBlocked, recordWin } from './session';

describe('session repeat-pattern blocking', () => {
  it('starts with nothing blocked', () => {
    const session = createSession('Tonight');
    expect(isPatternBlocked(session, 'four-corners')).toBe(false);
  });

  it('blocks a pattern after it has been won once this session', () => {
    let session = createSession('Tonight');
    session = recordWin(session, 'four-corners');
    expect(isPatternBlocked(session, 'four-corners')).toBe(true);
    expect(isPatternBlocked(session, 'x')).toBe(false);
  });

  it('does not duplicate a pattern id when won again with an override', () => {
    let session = createSession('Tonight');
    session = recordWin(session, 'four-corners');
    session = recordWin(session, 'four-corners');
    expect(session.wonPatternIds.filter((id) => id === 'four-corners').length).toBe(1);
  });

  it('a new session clears the block', () => {
    let session = createSession('Tonight');
    session = recordWin(session, 'four-corners');
    const next = createSession('Next Event');
    expect(isPatternBlocked(next, 'four-corners')).toBe(false);
    expect(session.id).not.toBe(next.id);
  });
});
