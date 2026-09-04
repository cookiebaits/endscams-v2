import crypto from 'crypto';

// Default salt for key derivation
const SALT = 'abstract_dokploy_salt_v1';

/**
 * Derives a 32-byte key from a secret string using scrypt.
 */
function deriveKey(secret: string): Buffer {
  return crypto.scryptSync(secret, SALT, 32);
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptValue(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12); // standard 12-byte IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  
  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a ciphertext in the format enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>.
 * If raw is not in encrypted format, it returns raw as-is (plaintext fallback).
 */
export function decryptValue(raw: string, secret: string): string {
  if (!raw || typeof raw !== 'string') return '';
  
  // If not encrypted format, return as plain key
  if (!raw.startsWith('enc:')) {
    return raw.trim();
  }
  
  try {
    const parts = raw.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted format. Expected enc:iv:tag:ciphertext');
    }
    
    const [, ivHex, tagHex, dataHex] = parts;
    const key = deriveKey(secret);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (err: any) {
    console.error('Decryption failed:', err.message);
    throw new Error(`Failed to decrypt secret: ${err.message}`);
  }
}

/**
 * Checks if a string is in the encrypted format
 */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith('enc:');
}
