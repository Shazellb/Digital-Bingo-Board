import { describe, expect, it } from 'vitest';
import { PairingLock } from './pairingLock';

const FIRST_SECRET = 'first-controller-secret';
const OTHER_SECRET = 'other-controller-secret';

describe('PairingLock', () => {
  it('binds the first controller and accepts its reconnects', () => {
    const lock = new PairingLock();
    expect(lock.authorize(FIRST_SECRET)).toEqual({ accepted: true, newlyBound: true });
    expect(lock.secret).toBe(FIRST_SECRET);
    expect(lock.authorize(FIRST_SECRET)).toEqual({ accepted: true, newlyBound: false });
  });

  it('rejects missing and incorrect secrets without disturbing the paired controller', () => {
    const lock = new PairingLock(FIRST_SECRET);
    expect(lock.authorize(undefined).accepted).toBe(false);
    expect(lock.authorize('').accepted).toBe(false);
    expect(lock.authorize(OTHER_SECRET).accepted).toBe(false);
    expect(lock.secret).toBe(FIRST_SECRET);
  });

  it('only releases for the paired controller and then allows a new pairing', () => {
    const lock = new PairingLock(FIRST_SECRET);
    expect(lock.release(OTHER_SECRET)).toBe(false);
    expect(lock.secret).toBe(FIRST_SECRET);
    expect(lock.release(FIRST_SECRET)).toBe(true);
    expect(lock.secret).toBeNull();
    expect(lock.authorize(OTHER_SECRET)).toEqual({ accepted: true, newlyBound: true });
  });
});
