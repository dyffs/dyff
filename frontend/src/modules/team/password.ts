const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generatePassword (length = 16): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  const chars: string[] = []
  for (const byte of bytes) {
    chars.push(ALPHABET.charAt(byte % ALPHABET.length))
  }
  return chars.join('')
}
