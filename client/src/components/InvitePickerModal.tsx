import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PlayerAvatar from "@/components/PlayerAvatar";
import { cn } from "@/lib/utils";
import {
  X, Search, Users, MapPin, Crown, Check, Loader2, Send, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type TargetType = "game" | "tournament" | "group" | "coaching";

interface InvitePickerModalProps {
  open: boolean;
  onClose: () => void;
  targetType: TargetType;
  targetId: number;
  targetName?: string;
}

export default function InvitePickerModal({
  open,
  onClose,
  targetType,
  targetId,
  targetName,
}: InvitePickerModalProps) {
  const { user, navigate } = useApp();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"matches" | "nearby">("matches");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const inviteableQuery = trpc.invites.getInviteable.useQuery(
    {
      lat: user?.latitude ?? 0,
      lng: user?.longitude ?? 0,
      radiusMiles: 25,
    },
    { enabled: open }
  );

  const sendInviteMutation = trpc.invites.send.useMutation({
    onSuccess: (data) => {
      toast.success(t("invite.sent", { count: data.sent }));
      setSelected(new Set());
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const data = inviteableQuery.data;
  const isPremium = data?.isPremium ?? user?.isPremium;

  const matchList = useMemo(() => {
    if (!data?.matches) return [];
    if (!search.trim()) return data.matches;
    const q = search.toLowerCase();
    return data.matches.filter(
      (u: any) =>
        u.name?.toLowerCase().includes(q) ||
        u.nickname?.toLowerCase().includes(q)
    );
  }, [data?.matches, search]);

  const nearbyList = useMemo(() => {
    if (!data?.nearby) return [];
    if (!search.trim()) return data.nearby;
    const q = search.toLowerCase();
    return data.nearby.filter(
      (u: any) =>
        u.name?.toLowerCase().includes(q) ||
        u.nickname?.toLowerCase().includes(q)
    );
  }, [data?.nearby, search]);

  const toggleUser = (userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSend = () => {
    if (selected.size === 0) return;
    sendInviteMutation.mutate({
      targetType,
      targetId,
      userIds: Array.from(selected),
    });
  };

  if (!open) return null;

  const typeLabel =
    targetType === "game"
      ? t("invite.type.game")
      : targetType === "tournament"
      ? t("invite.type.tournament")
      : targetType === "group"
      ? t("invite.type.group")
      : t("invite.type.coaching");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h2 className="text-base font-bold">{t("invite.title")}</h2>
            <p className="text-xs text-muted-foreground">
              {targetName ? t("invite.toTarget", { name: targetName }) : t("invite.toType", { type: typeLabel })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("invite.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mx-4">
          <button
            onClick={() => setActiveTab("matches")}
            className={cn(
              "flex-1 py-2 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5",
              activeTab === "matches"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            {t("invite.matches", { count: data?.matches?.length ?? 0 })}
          </button>
          <button
            onClick={() => setActiveTab("nearby")}
            className={cn(
              "flex-1 py-2 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5",
              activeTab === "nearby"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <MapPin className="w-3.5 h-3.5" />
            {t("invite.nearby")}
            {!isPremium && <Lock className="w-3 h-3 text-[#FFC107]" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-[200px]">
          {inviteableQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : activeTab === "matches" ? (
            matchList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {search ? t("invite.noMatchesFound") : t("invite.noMatchesYet")}
                </p>
                <p className="text-xs mt-1">
                  {t("invite.swipeHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {matchList.map((u: any) => (
                  <PlayerRow
                    key={u.id}
                    user={u}
                    selected={selected.has(u.id)}
                    onToggle={() => toggleUser(u.id)}
                  />
                ))}
              </div>
            )
          ) : !isPremium ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-[#FFC107]/10 flex items-center justify-center mx-auto mb-3">
                <Crown className="w-7 h-7 text-[#FFC107]" />
              </div>
              <h3 className="text-sm font-semibold mb-1">{t("invite.premiumFeature")}</h3>
              <p className="text-xs text-muted-foreground mb-4">
                {t("invite.premiumDesc")}
              </p>
              <Button
                size="sm"
                className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] text-black font-semibold"
                onClick={() => {
                  onClose();
                  navigate("premium");
                }}
              >
                <Crown className="w-4 h-4 mr-1" /> {t("invite.upgradePremium")}
              </Button>
            </div>
          ) : nearbyList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {search ? t("invite.noNearbyFound") : t("invite.noNearby")}
              </p>
              <p className="text-xs mt-1">
                {t("invite.enableLocation")}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {nearbyList.map((u: any) => (
                <PlayerRow
                  key={u.id}
                  user={u}
                  selected={selected.has(u.id)}
                  onToggle={() => toggleUser(u.id)}
                  distance={u.distance}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer — Send button */}
        {selected.size > 0 && (
          <div className="px-4 py-3 border-t border-border">
            <Button
              onClick={handleSend}
              disabled={sendInviteMutation.isPending}
              className="w-full gap-2"
            >
              {sendInviteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {t("invite.sendInvites", { count: selected.size })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerRow({
  user,
  selected,
  onToggle,
  distance,
}: {
  user: any;
  selected: boolean;
  onToggle: () => void;
  distance?: number;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
        selected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-muted/10 border border-transparent"
      )}
    >
      <PlayerAvatar
        user={{
          id: user.id,
          profilePhotoUrl: user.profilePhotoUrl,
          hasProfilePhoto: user.hasProfilePhoto,
          name: user.name,
          nickname: user.nickname,
        }}
        size="sm"
      />
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-medium truncate">
          {user.nickname || user.name || "Player"}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {user.skillLevel && <span>Skill {user.skillLevel}</span>}
          {distance != null && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {distance} mi
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
          selected
            ? "bg-primary border-primary"
            : "border-muted-foreground/30"
        )}
      >
        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>
    </button>
  );
}
