import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Gift, Copy, Loader2, CheckCircle, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function ReferralsScreen() {
  const { goBack } = useApp();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [redeemCode, setRedeemCode] = useState("");

  const referralsQuery = trpc.referrals.list.useQuery();
  const createMutation = trpc.referrals.create.useMutation({
    onSuccess: (data: any) => {
      utils.referrals.list.invalidate();
      toast.success(t("referral.codeCreated", { code: data.code }));
    },
    onError: (err) => toast.error(err.message),
  });
  const redeemMutation = trpc.referrals.redeem.useMutation({
    onSuccess: () => {
      utils.referrals.list.invalidate();
      setRedeemCode("");
      toast.success(t("referral.codeRedeemed"));
    },
    onError: (err) => toast.error(err.message),
  });

  const referrals: any[] = referralsQuery.data ?? [];
  const myCode = referrals.find((r: any) => r.isReferrer)?.code;

  const copyCode = () => {
    if (myCode) {
      navigator.clipboard.writeText(myCode);
      toast.success(t("referral.codeCopied"));
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Gift className="w-5 h-5 text-[#BFFF00]" />
          <h1 className="text-lg font-bold">{t("referral.title")}</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Your referral code */}
        <div className="card-elevated px-4 py-4">
          <h2 className="font-semibold text-sm mb-2">{t("referral.yourCode")}</h2>
          {myCode ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted/30 rounded-lg px-3 py-2 font-mono text-lg text-[#BFFF00]">{myCode}</div>
              <Button variant="outline" size="sm" onClick={copyCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full bg-[#BFFF00] text-black hover:bg-[#BFFF00]/90">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("referral.generateCode")}
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-2">{t("referral.shareCodeHint")}</p>
        </div>

        {/* Redeem a code */}
        <div className="card-elevated px-4 py-4">
          <h2 className="font-semibold text-sm mb-2">{t("referral.redeemTitle")}</h2>
          <div className="flex gap-2">
            <Input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder={t("referral.redeemPlaceholder")}
              className="flex-1 font-mono"
              maxLength={20}
            />
            <Button
              onClick={() => redeemMutation.mutate({ code: redeemCode })}
              disabled={!redeemCode || redeemMutation.isPending}
              className="bg-[#BFFF00] text-black hover:bg-[#BFFF00]/90"
            >
              {redeemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("referral.redeemButton")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("referral.redeemHint")}</p>
        </div>

        {/* Referral history */}
        <div className="card-elevated px-4 py-4">
          <h2 className="font-semibold text-sm mb-3">{t("referral.history")}</h2>
          {referralsQuery.isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("referral.noReferrals")}</p>
          ) : (
            <div className="space-y-2">
              {referrals.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                  <div className={cn("p-1.5 rounded-full", r.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400")}>
                    {r.status === "completed" ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono">{r.code}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.status}</p>
                  </div>
                  {r.xpRewarded > 0 && (
                    <span className="text-xs text-[#BFFF00] flex items-center gap-0.5">
                      <Zap className="w-3 h-3" /> +{r.xpRewarded} XP
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
