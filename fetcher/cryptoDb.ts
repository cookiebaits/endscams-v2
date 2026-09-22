/*
  Deno/Node compatible cryptographic utility to decrypt obfuscated database connection strings.
  Ensures database credentials are never stored or logged in plain-text.
*/

const DB_SECRET_KEY = "EndScamsWatchdogSecretKey2026";
const ENCRYPTED_DEFAULT_DB_URI = "NQEXJwQTCAAmDU5MRxQAFCcCERcWTj4WFXQAX3cKGA0dVTYmCxUhEAFGDgAfNhQPFQ4BPQIPWF9BXigEFSZNEhgDNgMVEA1KDAhpUFdBV1s7CgpGV0BTNg==";

export function decryptDbUri(cipherText: string = ENCRYPTED_DEFAULT_DB_URI, secretKey: string = DB_SECRET_KEY): string {
  try {
    const target = cipherText ? cipherText.trim() : ENCRYPTED_DEFAULT_DB_URI;
    if (!target) return '';
    if (target.startsWith('postgresql://') || target.startsWith('postgres://') || target.startsWith('http://') || target.startsWith('https://')) {
      return target;
    }
    const rawBinary = atob(target);
    let decrypted = "";
    for (let i = 0; i < rawBinary.length; i++) {
      decrypted += String.fromCharCode(rawBinary.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length));
    }
    return decrypted;
  } catch {
    return '';
  }
}

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
