import { useApp } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Bell, Shield, Eye, Lock, Moon, Globe, Trash2, ChevronRight, LogOut, Ghost, Download, UserX, KeyRound, Plane, Loader2, Mail, CheckCircle, Type, CheckCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function SettingsScreen() {
  const { user, navigate, goBack, logout, ghostMode, toggleGhostMode, readReceipts, toggleReadReceipts } = useApp();
  const { theme, toggleTheme: ctxToggleTheme, fontSize, setFontSize } = useTheme();
  const { language, setLanguage, t } = useI18n();

  const utils = trpc.useUtils();

  // Load preferences from server
  const prefsQuery = trpc.notifications.getPreferences.useQuery();
  const prefs = prefsQuery.data;

  const updatePrefsMutation = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => utils.notifications.getPreferences.invalidate(),
  });

  const [notifications, setNotifications] = useState(true);
  const [matchNotifs, setMatchNotifs] = useState(true);
  const [messageNotifs, setMessageNotifs] = useState(true);
  const [gameNotifs, setGameNotifs] = useState(true);
  const [showDistance, setShowDistance] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);

  // Sync local state from server when prefs load
  useEffect(() => {
    if (prefs) {
      setMatchNotifs(prefs.matchNotif ?? true);
      setMessageNotifs(prefs.messageNotif ?? true);
      setGameNotifs(prefs.gameInviteNotif ?? true);
      setShowDistance(prefs.showDistance ?? true);
      setShowOnline(prefs.showOnline ?? true);
      setPublicProfile(prefs.publicProfile ?? true);
      // Master toggle is on if any notification type is enabled
      setNotifications((prefs.matchNotif ?? true) || (prefs.messageNotif ?? true) || (prefs.gameInviteNotif ?? true));
    }
  }, [prefs]);

  const syncPref = useCallback((updates: Record<string, boolean>) => {
    updatePrefsMutation.mutate(updates);
  }, [updatePrefsMutation]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  // tRPC mutations for account actions
  const changePasswordMutation = trpc.account.changePassword.useMutation({
    onSuccess: () => {
      toast.success(t("settings.passwordUpdated"));
      setOldPassword("");
      setNewPassword("");
      setShowChangePassword(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAccountMutation = trpc.account.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success(t("settings.accountScheduledDeletion"), { duration: 5000 });
      setShowDeleteConfirm(false);
      setDeletePassword("");
      logout();
    },
    onError: (err) => toast.error(err.message),
  });

  const exportDataMutation = trpc.account.exportData.useMutation({
    onSuccess: (data) => {
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pkl-data-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("settings.dataExportDownloaded"));
    },
    onError: (err) => toast.error(err.message),
  });

  // Blocked users query (lazy loaded)
  const blockedUsersQuery = trpc.account.getBlockedUsers.useQuery(undefined, {
    enabled: showBlockedUsers,
  });
  const unblockMutation = trpc.account.unblockUser.useMutation({
    onSuccess: () => {
      blockedUsersQuery.refetch();
      toast.success(t("settings.userUnblocked"));
    },
  });

  // Email verification mutations
  const sendVerificationMutation = trpc.email.sendVerification.useMutation({
    onSuccess: () => toast.success(t("settings.verificationSent")),
    onError: (err) => toast.error(err.message),
  });
  const verifyCodeMutation = trpc.email.verifyCode.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(t("settings.emailVerifiedSuccess"));
        setShowEmailVerify(false);
        setVerificationCode("");
      } else {
        toast.error(data.error || t("settings.invalidCode"));
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword) {
      toast.error(t("settings.fillBothFields"));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t("settings.passwordMinLength"));
      return;
    }
    changePasswordMutation.mutate({ currentPassword: oldPassword, newPassword });
  };

  const toggleTheme = () => {
    ctxToggleTheme?.();
    const next = theme === "dark" ? t("settings.light") : t("settings.dark");
    toast(`${t("settings.theme")}: ${next}`);
  };

const toggleLanguage = () => {
      const next = language === "en" ? "fr" : "en";
      setLanguage(next);
      toast(next === "en" ? t("settings.languageEnglish") : t("settings.languageFrench"));
  };

  return (
    <div className="pb-24 min-h-screen">
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-primary/6 blur-3xl" />
        <div className="relative px-5 pt-7 pb-3 flex items-center gap-3">
          <button onClick={() => goBack()} aria-label="Go back" className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{t("settings.title")}</h1>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Notifications */}
        <div className="card-elevated rounded-xl p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center">
              <Bell size={12} className="text-secondary" />
            </div>
            {t("settings.notifications")}
          </h2>
          <div className="space-y-3">
            <SettingRow label={t("settings.pushNotifications")} desc={t("settings.pushNotificationsDesc")} checked={notifications} onChange={v => { setNotifications(v); syncPref({ pushEnabled: v }); toast(v ? t("settings.notificationsEnabled") : t("settings.notificationsDisabled")); }} />
            <SettingRow label={t("settings.newMatches")} desc={t("settings.newMatchesDesc")} checked={matchNotifs} onChange={v => { setMatchNotifs(v); syncPref({ matchNotif: v }); }} />
            <SettingRow label={t("settings.messages")} desc={t("settings.messagesDesc")} checked={messageNotifs} onChange={v => { setMessageNotifs(v); syncPref({ messageNotif: v }); }} />
            <SettingRow label={t("settings.gameReminders")} desc={t("settings.gameRemindersDesc")} checked={gameNotifs} onChange={v => { setGameNotifs(v); syncPref({ gameInviteNotif: v }); }} />
          </div>
        </div>

        {/* Privacy */}
        <div className="card-elevated rounded-xl p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Shield size={12} className="text-primary" />
            </div>
            {t("settings.privacy")}
          </h2>
          <div className="space-y-3">
            <SettingRow label={t("settings.showDistance")} desc={t("settings.showDistanceDesc")} checked={showDistance} onChange={v => { setShowDistance(v); syncPref({ showDistance: v }); }} />
            <SettingRow label={t("settings.onlineStatus")} desc={t("settings.onlineStatusDesc")} checked={showOnline} onChange={v => { setShowOnline(v); syncPref({ showOnline: v }); }} />
            <SettingRow label={t("settings.publicProfile")} desc={t("settings.publicProfileDesc")} checked={publicProfile} onChange={v => { setPublicProfile(v); syncPref({ publicProfile: v }); }} />
            {user.isPremium && (
              <div className="flex items-center justify-between pt-1 border-t border-border/20">
                <div>
                  <p className="text-sm flex items-center gap-1.5">
                    <Ghost size={14} className="text-accent" />
                    {t("settings.ghostMode")}
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary font-medium">{t("settings.proBadge")}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t("settings.ghostModeDesc")}</p>
                </div>
                <Switch checked={ghostMode} onCheckedChange={() => { toggleGhostMode(); toast(ghostMode ? t("settings.ghostModeDisabled") : t("settings.ghostModeEnabled")); }} />
              </div>
            )}
            {user.isPremium && (
              <div className="flex items-center justify-between pt-1 border-t border-border/20">
                <div>
                  <p className="text-sm flex items-center gap-1.5">
                    <CheckCheck size={14} className="text-accent" />
                    {t("settings.readReceipts")}
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary font-medium">{t("settings.proBadge")}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t("settings.readReceiptsDesc")}</p>
                </div>
                <Switch checked={readReceipts} onCheckedChange={() => { toggleReadReceipts(); toast(readReceipts ? t("settings.readReceiptsDisabled") : t("settings.readReceiptsEnabled")); }} />
              </div>
            )}
            {user.isPremium && (
              <TravelMode />
            )}
          </div>
        </div>

        {/* Display */}
        <div className="card-elevated rounded-xl p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Eye size={12} className="text-primary" />
            </div>
            {t("settings.display")}
          </h2>
          <button onClick={toggleTheme} className="w-full flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Moon size={14} className="text-muted-foreground" />
              <span className="text-sm">{t("settings.theme")}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{theme === "dark" ? t("settings.dark") : t("settings.light")}</span>
              <ChevronRight size={14} />
            </div>
          </button>
<button onClick={toggleLanguage} className="w-full flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-muted-foreground" />
                <span className="text-sm">{t("settings.language")}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{language === "en" ? "English" : "Français"}</span>
              <ChevronRight size={14} />
            </div>
          </button>

          {/* Font Size */}
          <div className="py-2 border-t border-border/20">
            <div className="flex items-center gap-2 mb-2">
              <Type size={14} className="text-muted-foreground" />
              <span className="text-sm">{t("settings.textSize")}</span>
            </div>
            <div className="flex gap-2">
              {(["small", "default", "large"] as const).map(size => (
                <button
                  key={size}
                  onClick={() => { setFontSize(size); toast(`${t("settings.textSize")}: ${size === "default" ? t("settings.sizeMedium") : size === "small" ? t("settings.sizeSmall") : t("settings.sizeLarge")}`); }}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    fontSize === size
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border/30 text-muted-foreground hover:border-border"
                  )}
                >
                  {size === "small" ? "A" : size === "default" ? "A" : "A"}
                  <span className="ml-1 text-[10px]">{size === "default" ? t("settings.sizeMedium") : size === "small" ? t("settings.sizeSmall") : t("settings.sizeLarge")}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data & Account */}
        <div className="card-elevated rounded-xl p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Lock size={12} className="text-primary" />
            </div>
            {t("settings.account")}
          </h2>

          {/* Change Password */}
          <button onClick={() => setShowChangePassword(!showChangePassword)} className="w-full flex items-center justify-between py-2 text-sm">
            <span className="flex items-center gap-2"><KeyRound size={13} className="text-muted-foreground" /> {t("settings.changePassword")}</span>
            <ChevronRight size={14} className={cn("text-muted-foreground transition-transform", showChangePassword && "rotate-90")} />
          </button>
          {showChangePassword && (
            <div className="pl-6 pb-3 space-y-2">
              <input
                type="password"
                placeholder={t("settings.currentPassword")}
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="w-full text-sm bg-background/50 border border-border/30 rounded-lg px-3 py-1.5 placeholder:text-muted-foreground/50"
              />
              <input
                type="password"
                placeholder={t("settings.newPassword")}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full text-sm bg-background/50 border border-border/30 rounded-lg px-3 py-1.5 placeholder:text-muted-foreground/50"
              />
              <button onClick={handleChangePassword} className="text-xs font-medium text-secondary hover:underline disabled:opacity-50" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? t("settings.saving") : t("settings.savePassword")}
              </button>
            </div>
          )}

          {/* Blocked Users */}

          {/* Email Verification */}
          {!user.isVerified ? (
            <>
              <button onClick={() => setShowEmailVerify(!showEmailVerify)} className="w-full flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2"><Mail size={13} className="text-secondary" /> {t("settings.verifyEmail")}</span>
                <ChevronRight size={14} className={cn("text-muted-foreground transition-transform", showEmailVerify && "rotate-90")} />
              </button>
              {showEmailVerify && (
                <div className="pl-6 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">{t("settings.verificationDesc")} <span className="text-foreground font-medium">{user.email}</span></p>
                  <button
                    onClick={() => sendVerificationMutation.mutate()}
                    disabled={sendVerificationMutation.isPending}
                    className="text-xs font-medium text-secondary hover:underline disabled:opacity-50"
                  >
                    {sendVerificationMutation.isPending ? t("settings.sending") : t("settings.sendVerificationCode")}
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t("settings.enterCode")}
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full text-sm bg-background/50 border border-border/30 rounded-lg px-3 py-1.5 placeholder:text-muted-foreground/50 tracking-widest text-center font-mono"
                  />
                  <button
                    onClick={() => verifyCodeMutation.mutate({ code: verificationCode })}
                    disabled={verificationCode.length !== 6 || verifyCodeMutation.isPending}
                    className="text-xs font-medium text-secondary hover:underline disabled:opacity-50"
                  >
                    {verifyCodeMutation.isPending ? t("settings.verifying") : t("settings.verify")}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 py-2 text-sm text-secondary">
              <CheckCircle size={13} /> {t("settings.emailVerified")}
            </div>
          )}

          {/* Blocked Users */}
          <button onClick={() => setShowBlockedUsers(!showBlockedUsers)} className="w-full flex items-center justify-between py-2 text-sm">
            <span className="flex items-center gap-2"><UserX size={13} className="text-muted-foreground" /> {t("settings.blockedUsers")}</span>
            <ChevronRight size={14} className={cn("text-muted-foreground transition-transform", showBlockedUsers && "rotate-90")} />
          </button>
          {showBlockedUsers && (
            <div className="pl-6 pb-3">
              {blockedUsersQuery.isLoading ? (
                <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
              ) : (blockedUsersQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground/60 py-2 text-center">{t("settings.noBlockedUsers")}</p>
              ) : (
                <div className="space-y-2">
                  {(blockedUsersQuery.data ?? []).map((bu: any) => (
                    <div key={bu.id} className="flex items-center justify-between text-xs">
                      <span>{bu.nickname || bu.name || `User #${bu.id}`}</span>
                      <button
                        onClick={() => unblockMutation.mutate({ blockedId: bu.id })}
                        className="text-secondary hover:underline"
                      >
                        {t("settings.unblock")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Download Data */}
          <button onClick={() => exportDataMutation.mutate()} disabled={exportDataMutation.isPending} className="w-full flex items-center justify-between py-2 text-sm disabled:opacity-50">
            <span className="flex items-center gap-2">
              {exportDataMutation.isPending ? <Loader2 size={13} className="animate-spin text-muted-foreground" /> : <Download size={13} className="text-muted-foreground" />}
              {exportDataMutation.isPending ? t("settings.exporting") : t("settings.downloadMyData")}
            </span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Danger Zone */}
        <div className="space-y-2">
          <button
            onClick={logout}
            className="w-full card-elevated rounded-xl p-4 flex items-center gap-2 text-sm text-secondary hover:border-secondary/40 transition-all"
          >
            <LogOut size={14} /> {t("settings.logOut")}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full card-elevated rounded-xl p-4 flex items-center gap-2 text-sm text-red-400 hover:border-red-400/40 transition-all"
          >
            <Trash2 size={14} /> {t("settings.deleteAccount")}
          </button>
        </div>

        {/* Delete Account Confirmation */}
        {showDeleteConfirm && (
          <div className="card-elevated rounded-xl p-4 border-red-500/30">
            <h3 className="text-sm font-bold text-red-400 mb-2">{t("settings.deleteAccountWarning")}</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {t("settings.deleteAccountDesc")}
            </p>
            <input
              type="password"
              placeholder="Enter your password to confirm"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full rounded-lg bg-muted/20 border border-border px-3 py-2 text-sm mb-3 focus:outline-none focus:border-red-500/50"
            />
            <div className="flex gap-2">
              <button onClick={() => deleteAccountMutation.mutate({ password: deletePassword })} disabled={deleteAccountMutation.isPending || !deletePassword} className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all disabled:opacity-50">
                {deleteAccountMutation.isPending ? t("settings.deleting") : t("settings.yesDeleteMyAccount")}
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); }} className="flex-1 py-2 rounded-xl bg-muted/20 text-muted-foreground text-xs font-medium hover:bg-muted/30 transition-all">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {/* App Info */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">{t("settings.appVersion")}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">{t("settings.copyright")}</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">{t("settings.tagline")}</p>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function TravelMode() {
  const { t } = useI18n();
  const { user } = useApp();
  const travelMutation = trpc.users.setTravelMode.useMutation({
    onSuccess: () => { trpc.useUtils().auth.me.invalidate(); },
  });
  const enabled = !!user?.travelModeCity;
  const currentCity = user?.travelModeCity ?? "";

  // City name → approx coordinates for Travel Mode
  const cities: { name: string; lat: number; lng: number }[] = [
    { name: "New York, NY", lat: 40.7128, lng: -74.006 },
    { name: "Los Angeles, CA", lat: 34.0522, lng: -118.2437 },
    { name: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
    { name: "Houston, TX", lat: 29.7604, lng: -95.3698 },
    { name: "Miami, FL", lat: 25.7617, lng: -80.1918 },
    { name: "Seattle, WA", lat: 47.6062, lng: -122.3321 },
    { name: "Denver, CO", lat: 39.7392, lng: -104.9903 },
    { name: "Portland, OR", lat: 45.5152, lng: -122.6784 },
  ];

  return (
    <div className="pt-1 border-t border-border/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm flex items-center gap-1.5">
            <Plane size={14} className="text-secondary" />
            {t("settings.travelMode")}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary font-medium">PRO</span>
          </p>
          <p className="text-[10px] text-muted-foreground">{t("settings.travelModeDesc")}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={(v) => {
          if (!v) {
            travelMutation.mutate({ lat: null, lng: null, city: null });
            toast(t("settings.travelModeDisabled"));
          }
        }} />
      </div>
      {(enabled || !currentCity) && (
        <div className="mt-2 space-y-1.5">
          <div className="flex gap-1.5 flex-wrap">
            {cities.map(c => (
              <button
                key={c.name}
                onClick={() => {
                  travelMutation.mutate({ lat: c.lat, lng: c.lng, city: c.name });
                  toast.success(`${t("settings.locationChanged")}: ${c.name}`);
                }}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-full border transition-colors",
                  currentCity === c.name ? "border-secondary bg-secondary/20 text-secondary" : "border-border text-muted-foreground"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
