export interface SessionState {
  id: string;
  label: string;
  startedAt: number;
  wonPatternIds: string[];
}

let sessionCounter = 0;

export function createSession(label: string): SessionState {
  sessionCounter += 1;
  return {
    id: `session-${Date.now()}-${sessionCounter}`,
    label,
    startedAt: Date.now(),
    wonPatternIds: [],
  };
}

/** True when this pattern has already been won earlier in the same session. */
export function isPatternBlocked(session: SessionState, patternId: string): boolean {
  return session.wonPatternIds.includes(patternId);
}

export function recordWin(session: SessionState, patternId: string): SessionState {
  if (session.wonPatternIds.includes(patternId)) return session;
  return { ...session, wonPatternIds: [...session.wonPatternIds, patternId] };
}
