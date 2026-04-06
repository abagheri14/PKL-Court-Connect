/**
 * E2E Message Encryption using Web Crypto API (AES-GCM + ECDH key exchange)
 *
 * Flow:
 * 1. Each user generates an ECDH key pair on first use, stored in IndexedDB.
 * 2. Public key is shared via server (stored on user profile).
 * 3. When chatting, a shared secret is derived from (myPrivate + theirPublic).
 * 4. Messages encrypted with AES-256-GCM using the shared secret.
 * 5. Encrypted payload stored on server; only the two parties can decrypt.
 */

const DB_NAME = "pkl-e2e";
const STORE_NAME = "keys";
const KEY_ID = "e2e-keypair";

// ── IndexedDB helpers ──

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Key pair management ──

interface StoredKeyPair {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

const ECDH_PARAMS: EcKeyGenParams = {
  name: "ECDH",
  namedCurve: "P-256",
};

export async function getOrCreateKeyPair(): Promise<{ publicKey: JsonWebKey; privateKey: CryptoKey }> {
  const stored = await dbGet<StoredKeyPair>(KEY_ID);

  if (stored) {
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      stored.privateKey,
      ECDH_PARAMS,
      false,
      ["deriveBits"],
    );
    return { publicKey: stored.publicKey, privateKey };
  }

  // Generate new ECDH key pair
  const keyPair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveBits"]);

  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  await dbPut(KEY_ID, { publicKey: publicJwk, privateKey: privateJwk } satisfies StoredKeyPair);

  // Re-import private key as non-extractable for use
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, ECDH_PARAMS, false, ["deriveBits"]);

  return { publicKey: publicJwk, privateKey };
}

/** Export the public key as a base64 string for sending to the server */
export async function getPublicKeyBase64(): Promise<string> {
  const { publicKey } = await getOrCreateKeyPair();
  return btoa(JSON.stringify(publicKey));
}

/** Import a peer's public key from base64 string */
async function importPeerPublicKey(base64: string): Promise<CryptoKey> {
  const jwk: JsonWebKey = JSON.parse(atob(base64));
  return crypto.subtle.importKey("jwk", jwk, ECDH_PARAMS, false, []);
}

// ── Shared secret derivation ──

async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey,
): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: peerPublicKey },
    myPrivateKey,
    256,
  );
  return crypto.subtle.importKey("raw", sharedBits, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// ── Encrypt / Decrypt ──

interface EncryptedPayload {
  iv: string; // base64 12-byte IV
  ct: string; // base64 ciphertext
}

export async function encryptMessage(
  plaintext: string,
  peerPublicKeyBase64: string,
): Promise<string> {
  const { privateKey } = await getOrCreateKeyPair();
  const peerPub = await importPeerPublicKey(peerPublicKeyBase64);
  const sharedKey = await deriveSharedKey(privateKey, peerPub);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);

  const payload: EncryptedPayload = {
    iv: btoa(Array.from(iv, (b) => String.fromCharCode(b)).join("")),
    ct: btoa(Array.from(new Uint8Array(ciphertext), (b) => String.fromCharCode(b)).join("")),
  };

  return `e2e:${btoa(JSON.stringify(payload))}`;
}

export async function decryptMessage(
  encrypted: string,
  peerPublicKeyBase64: string,
): Promise<string> {
  if (!encrypted.startsWith("e2e:")) return encrypted; // not encrypted, return as-is

  const { privateKey } = await getOrCreateKeyPair();
  const peerPub = await importPeerPublicKey(peerPublicKeyBase64);
  const sharedKey = await deriveSharedKey(privateKey, peerPub);

  const payload: EncryptedPayload = JSON.parse(atob(encrypted.slice(4)));

  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(payload.ct), c => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ct);

  return new TextDecoder().decode(decrypted);
}

/** Check if a message string is E2E encrypted */
export function isEncrypted(content: string): boolean {
  return content.startsWith("e2e:");
}
