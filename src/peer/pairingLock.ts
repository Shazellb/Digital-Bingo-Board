const SECRET_BYTES = 24;

export interface PairingDecision {
  accepted: boolean;
  newlyBound: boolean;
}

/** Display-side authorization state. The first valid secret claims the room. */
export class PairingLock {
  private boundSecret: string | null;

  constructor(boundSecret: string | null = null) {
    this.boundSecret = boundSecret;
  }

  get secret(): string | null {
    return this.boundSecret;
  }

  authorize(candidate: unknown): PairingDecision {
    if (typeof candidate !== 'string' || candidate.length < 16) {
      return { accepted: false, newlyBound: false };
    }
    if (this.boundSecret === null) {
      this.boundSecret = candidate;
      return { accepted: true, newlyBound: true };
    }
    return { accepted: candidate === this.boundSecret, newlyBound: false };
  }

  release(candidate: unknown): boolean {
    if (this.boundSecret === null || candidate !== this.boundSecret) return false;
    this.boundSecret = null;
    return true;
  }
}

export function controllerSecretStorageKey(roomCode: string): string {
  return `bingo:controller-secret:${roomCode}`;
}

export function loadOrCreateControllerSecret(roomCode: string, storage: Storage = localStorage): string {
  const key = controllerSecretStorageKey(roomCode);
  const existing = storage.getItem(key);
  if (existing && existing.length >= 16) return existing;

  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  storage.setItem(key, secret);
  return secret;
}
