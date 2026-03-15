import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

const ENCRYPTION_KEY = (import.meta as any).env.VITE_ENCRYPTION_KEY || 'default-secret-key-32-chars-long-!!';

// Ensure key is 32 bytes
  return finalKey;
};

export const encryptData = (data: any): string | null => {
  if (!data) return null;
  try {
    const nonce = nacl.randomBytes(24);

    fullMessage.set(nonce);
    fullMessage.set(box, nonce.length);

    return encodeBase64(fullMessage);
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

export const decryptData = (encryptedData: string | null): any => {
  if (!encryptedData) return null;
  try {
    const fullMessage = decodeBase64(encryptedData);
    const nonce = fullMessage.slice(0, 24);
    const message = fullMessage.slice(24);

    const decrypted = nacl.secretbox.open(message, nonce, key);
    if (!decrypted) return null;

    return JSON.parse(encodeUTF8(decrypted));
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
