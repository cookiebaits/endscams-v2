/**
 * Utility to decrypt obfuscated/encrypted database connection strings at runtime.
 * Ensures connection strings with sensitive credentials are never stored in plain-text.
 */

const DB_SECRET_KEY = "EndScamsWatchdogSecretKey2026";
const ENCRYPTED_DEFAULT_DB_URI = "NQEXJwQTCAAmDU5MRxQAFCcCERcWTj4WFXQAX3cKGA0dVTYmCxUhEAFGDgAfNhQPFQ4BPQIPWF9BXigEFSZNEhgDNgMVEA1KDAhpUFdBV1s7CgpGV0BTNg==";

/**
 * Decrypts an encrypted Base64 XOR token into its original connection string.
 */
export function decryptDbUri(cipherText: string = ENCRYPTED_DEFAULT_DB_URI, secretKey: string = DB_SECRET_KEY): string {
  try {
    if (!cipherText || !cipherText.trim()) return '';
    // If input is already an unencrypted postgresql:// or https:// URL, return it directly
    if (cipherText.startsWith('postgresql://') || cipherText.startsWith('postgres://') || cipherText.startsWith('http://') || cipherText.startsWith('https://')) {
      return cipherText.trim();
    }
    const rawBinary = atob(cipherText.trim());
    let decrypted = "";
    for (let i = 0; i < rawBinary.length; i++) {
      decrypted += String.fromCharCode(rawBinary.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length));
    }
    return decrypted;
  } catch {
    return '';
  }
}

/**
 * Encrypts a plain-text database connection string into a Base64 XOR token.
 */
export function encryptDbUri(plainText: string, secretKey: string = DB_SECRET_KEY): string {
  try {
    let xor = "";
    for (let i = 0; i < plainText.length; i++) {
      xor += String.fromCharCode(plainText.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length));
    }
    return btoa(xor);
  } catch {
    return '';
  }
}
