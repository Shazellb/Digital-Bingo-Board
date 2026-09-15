const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid ambiguity
const PEER_ID_PREFIX = 'bingo-board-';

export function generateRoomCode(length = 4): string {
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[arr[i] % ALPHABET.length];
  }
  return code;
}

export function roomCodeToPeerId(code: string): string {
  return `${PEER_ID_PREFIX}${code.trim().toUpperCase()}`;
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
