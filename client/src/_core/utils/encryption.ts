import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

const ENCRYPTION_KEY = (import.meta as any).env.VITE_ENCRYPTION_KEY || 'default-secret-key-32-chars-long-!!';

// Ensure key is 32 bytes
const getUint8Key = (key: string) => {
  const keyUint8 = decodeUTF8(key);
  const finalKey = new Uint8Array(32);
  finalKey.set(keyUint8.slice(0, 32));
  return finalKey;
};

export const encryptData = (data: any): string | null => {
  if (!data) return null;
  try {
    const key = getUint8Key(ENCRYPTION_KEY);
    const nonce = nacl.randomBytes(24);
    const messageUint8 = decodeUTF8(JSON.stringify(data));
    const box = nacl.secretbox(messageUint8, nonce, key);

    const fullMessage = new Uint8Array(nonce.length + box.length);
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
    const key = getUint8Key(ENCRYPTION_KEY);
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
};
