import { useState } from "react";
import { trpc } from "@/lib/trpc";
import ChallengeReceived from "./ChallengeReceived";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function ChallengeOverlay() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const utils = trpc.useUtils();

  const pendingQuery = trpc.challenges.pending.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const respondMutation = trpc.challenges.respond.useMutation({
    onSuccess: (_data, variables) => {
      utils.challenges.pending.invalidate();
      utils.challenges.allPending.invalidate();
      if (variables.accept) {
        toast.success(t("challengeReceived.accepted"));
      } else {
        toast(t("challengeReceived.declined"));
      }
    },
  });

  const pendingChallenges = pendingQuery.data ?? [];
  // Show the first pending challenge that hasn't been dismissed
  const activeChallenge = pendingChallenges.find(c => !dismissed.has(c.id));

  if (!activeChallenge) return null;

  return (
    <ChallengeReceived
      challenge={activeChallenge}
      onAccept={() => {
        respondMutation.mutate({ challengeId: activeChallenge.id, accept: true });
        setDismissed(prev => new Set(prev).add(activeChallenge.id));
      }}
      onDecline={() => {
        respondMutation.mutate({ challengeId: activeChallenge.id, accept: false });
        setDismissed(prev => new Set(prev).add(activeChallenge.id));
      }}
    />
  );
}
