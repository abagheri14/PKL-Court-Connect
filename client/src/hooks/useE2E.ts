import { useEffect, useState, useCallback, useRef } from "react";
import { encryptMessage, decryptMessage, getPublicKeyBase64, isEncrypted } from "@/lib/e2e";
import { trpc } from "@/lib/trpc";

/**
 * Hook that manages E2E encryption for a specific chat conversation.
 * Publishes our public key to the server and retrieves the peer's public key.
 * Provides encrypt() and decrypt() helpers scoped to the peer.
 */
export function useE2E(peerUserId: number | null | undefined) {
  const [peerPublicKey, setPeerPublicKey] = useState<string | null>(null);
  const [myPublicKey, setMyPublicKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);

  // Fetch the peer's profile for their e2ePublicKey
  const peerQuery = trpc.users.getProfile.useQuery(
    { userId: peerUserId! },
    { enabled: !!peerUserId },
  );

  const updateProfileMutation = trpc.users.updateProfile.useMutation();

  // On mount, generate/retrieve our key pair and publish public key
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    getPublicKeyBase64().then((pubKey) => {
      setMyPublicKey(pubKey);
      // Only publish if the key has changed since last publish
      const lastPublished = localStorage.getItem("e2e_published_key");
      if (lastPublished !== pubKey) {
        updateProfileMutation.mutate({ e2ePublicKey: pubKey }, {
          onSuccess: () => localStorage.setItem("e2e_published_key", pubKey),
        });
      }
    }).catch(() => {
      // E2E key generation failed — encryption disabled, messages still send unencrypted
    });
  }, []);

  // Extract peer's public key from their profile
  useEffect(() => {
    const peerKey = (peerQuery.data as any)?.e2ePublicKey;
    if (peerKey && typeof peerKey === "string") {
      setPeerPublicKey(peerKey);
      if (myPublicKey) setReady(true);
    }
  }, [peerQuery.data, myPublicKey]);

  const encrypt = useCallback(
    async (plaintext: string): Promise<string> => {
      if (!peerPublicKey) return plaintext; // fallback: send plaintext
      try {
        return await encryptMessage(plaintext, peerPublicKey);
      } catch {
        return plaintext; // graceful fallback
      }
    },
    [peerPublicKey],
  );

  const decrypt = useCallback(
    async (content: string): Promise<string> => {
      if (!peerPublicKey || !isEncrypted(content)) return content;
      try {
        return await decryptMessage(content, peerPublicKey);
      } catch {
        return "[Unable to decrypt]";
      }
    },
    [peerPublicKey],
  );

  return { encrypt, decrypt, ready, isEncrypted: !!peerPublicKey && !!myPublicKey };
}
