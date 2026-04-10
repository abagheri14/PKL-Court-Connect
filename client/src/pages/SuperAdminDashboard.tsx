import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Shield, Server, Database, Globe, Users, Activity, Settings, AlertTriangle, CheckCircle, Lock, HardDrive, Cpu, Wifi, Zap, Loader2, ToggleLeft, ToggleRight, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import PlayerAvatar from "@/components/PlayerAvatar";
import { QueryError } from "@/components/QueryError";
import { useTranslation } from "react-i18next";

const tabKeys = ["systemHealth", "accessControl", "globalConfig", "auditLog"] as const;

export default function SuperAdminDashboard() {
  const { user, navigate, goBack } = useApp();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("systemHealth");

  const statsQuery = trpc.admin.getStats.useQuery(undefined, { refetchInterval: 30000 });
  const usersQuery = trpc.admin.getUsers.useQuery(undefined, { refetchInterval: 30000 });
  const settingsQuery = trpc.admin.getAppSettings.useQuery(undefined, { refetchInterval: 60000 });
  const reportsQuery = trpc.admin.getReports.useQuery(undefined, { refetchInterval: 30000 });
  const updateSettingMutation = trpc.admin.updateAppSetting.useMutation({
    onSuccess: () => { settingsQuery.refetch(); toast.success(t("admin.settingUpdated")); },
    onError: (err) => toast.error(err.message),
  });
  const updateRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => { usersQuery.refetch(); toast.success(t("admin.roleUpdated")); },
    onError: (err) => toast.error(err.message),
  });

  const stats: any = statsQuery.data ?? {};
  const adminUsers: any[] = (usersQuery.data ?? []).filter((u: any) => u.role === "admin" || u.role === "superadmin");
  const appSettings: any[] = settingsQuery.data ?? [];
  const auditReports: any[] = reportsQuery.data ?? [];

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (user?.role !== "superadmin") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card-elevated rounded-xl p-6 text-center">
          <Lock size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t("admin.accessRequired")}</p>
          <Button onClick={() => navigate("home")} variant="outline" className="mt-4">{t("admin.goHome")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen">
      {/* Premium Header */}
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-accent/8 blur-3xl" />
        <div className="relative px-5 pt-7 pb-3 flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{t("admin.title")}</h1>
          <span className="ml-auto sport-badge sport-badge-gold text-[9px]">SUPER ADMIN</span>
        </div>
      </div>

      {/* Tabs — Premium pill-tab-active style */}
      <div className="px-5 pb-4 flex gap-1.5 overflow-x-auto scrollbar-none">
        {tabKeys.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
              activeTab === tab
                ? "pill-tab-active text-white"
                : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
            )}
          >
            {t(`admin.tab.${tab}`)}
          </button>
        ))}
      </div>

      {/* System Health */}
      {activeTab === "systemHealth" && (
        <div className="px-5 space-y-4">
          {statsQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
          ) : statsQuery.isError ? (
            <QueryError message={t("admin.loadStatsFailed")} onRetry={() => statsQuery.refetch()} />
          ) : (
            <>
              {/* Status Banner */}
              <div className="card-elevated rounded-xl p-4 border-green-500/30 bg-green-500/5">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-400" />
                  <div>
                    <p className="text-sm font-semibold text-green-400">{t("admin.allSystemsOperational")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("admin.lastChecked")}</p>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard icon={<Users size={14} />} label={t("admin.totalUsers")} value={String(stats.totalUsers ?? 0)} color="purple" />
                <MetricCard icon={<Activity size={14} />} label={t("admin.activeUsers")} value={String(stats.activeUsers ?? 0)} color="blue" />
                <MetricCard icon={<Globe size={14} />} label={t("admin.totalMatches")} value={String(stats.totalMatches ?? 0)} color="green" />
                <MetricCard icon={<AlertTriangle size={14} />} label={t("admin.pendingReports")} value={String(stats.pendingReports ?? 0)} color="yellow" />
              </div>

              {/* Resource Usage */}
              <div className="card-elevated rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Server size={14} className="text-secondary" /> {t("admin.platformOverview")}
                </h3>
                <div className="space-y-3">
                  <ResourceBar icon={<Users size={12} />} label={t("admin.activeUsers")} value={stats.totalUsers ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0} />
                  <ResourceBar icon={<Database size={12} />} label={t("admin.reportsResolved")} value={stats.pendingReports > 0 ? Math.max(0, 100 - stats.pendingReports * 10) : 100} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Access Control */}
      {activeTab === "accessControl" && (
        <div className="px-5 space-y-4">
          {usersQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
          ) : usersQuery.isError ? (
            <QueryError message={t("admin.loadUsersFailed")} onRetry={() => usersQuery.refetch()} />
          ) : (
            <>
              <div className="card-elevated rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Shield size={14} className="text-secondary" /> {t("admin.adminUsers")}
                </h3>
                <div className="space-y-3">
                  {adminUsers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">{t("admin.noAdminUsers")}</p>
                  ) : adminUsers.map((admin: any) => (
                    <div key={admin.id} className="flex items-center gap-3 p-2 rounded-xl bg-background/30">
                      <PlayerAvatar user={{ id: admin.id, name: admin.name, nickname: admin.nickname, profilePhotoUrl: admin.profilePhotoUrl, hasProfilePhoto: !!admin.profilePhotoUrl }} size="sm" showBadges={false} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{admin.name || admin.nickname || `User #${admin.id}`}</p>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            admin.isActive ? "bg-green-400" : "bg-muted-foreground/30"
                          )} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">{admin.email}</p>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium",
                        admin.role === "superadmin"
                          ? "bg-accent/20 text-accent"
                          : "bg-red-500/20 text-red-400"
                      )}>
                        {admin.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-elevated rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3">{t("admin.rolePermissions")}</h3>
                <div className="space-y-2">
                  {[
                    { role: t("admin.role.user"), permissions: t("admin.permissions.user") },
                    { role: t("admin.role.admin"), permissions: t("admin.permissions.admin") },
                    { role: t("admin.role.superAdmin"), permissions: t("admin.permissions.superAdmin") },
                  ].map((r, i) => (
                    <div key={i} className="p-2 rounded-xl bg-background/30">
                      <p className="text-xs font-semibold text-secondary">{r.role}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{r.permissions}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Global Config */}
      {activeTab === "globalConfig" && (
        <div className="px-5 space-y-3">
          {settingsQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
          ) : settingsQuery.isError ? (
            <QueryError message={t("admin.loadSettingsFailed")} onRetry={() => settingsQuery.refetch()} />
          ) : (
            <>
              <div className="card-elevated rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Settings size={14} className="text-secondary" /> {t("admin.appSettings")}
                </h3>
                {appSettings.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{t("admin.noSettings")}</p>
                ) : (
                  <div className="space-y-3">
                    {appSettings.map((setting: any) => (
                      <div key={setting.key} className="flex items-center justify-between p-2 rounded-xl bg-background/30">
                        <div className="flex-1">
                          <p className="text-xs font-mono text-muted-foreground">{setting.key}</p>
                        </div>
                        {editingKey === setting.key ? (
                          <div className="flex items-center gap-2 ml-3">
                            <Input
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              className="h-7 w-32 text-xs"
                            />
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                updateSettingMutation.mutate({ key: setting.key, value: editValue });
                                setEditingKey(null);
                              }}
                              disabled={updateSettingMutation.isPending}
                            >
                              {t("common.save")}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingKey(null)}>✕</Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingKey(setting.key); setEditValue(setting.value); }}
                            className="text-xs font-semibold text-secondary ml-3 hover:underline"
                          >
                            {setting.value}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card-elevated rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Zap size={14} className="text-secondary" /> {t("admin.globalEvents")}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-background/30">
                    <div>
                      <p className="text-xs font-medium">{t("admin.doubleXpWeekend")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("admin.doubleXpDesc")}</p>
                    </div>
                    <Button
                      size="sm"
                      className="text-xs bg-secondary text-background hover:bg-secondary/80"
                      onClick={() => {
                        updateSettingMutation.mutate({ key: "double_xp_active", value: "true" });
                        toast.success(t("admin.doubleXpActivated"), { icon: "⚡", duration: 5000 });
                      }}
                    >
                      {t("admin.activate")}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-background/30">
                    <div>
                      <p className="text-xs font-medium">{t("admin.communityChallenge")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("admin.communityChallengeDesc")}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        updateSettingMutation.mutate({ key: "community_challenge_active", value: "true" });
                        toast.success(t("admin.challengeLaunched"), { icon: "🏆", duration: 5000 });
                      }}
                    >
                      {t("admin.launch")}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Maintenance Mode */}
              <div className="card-elevated rounded-xl p-4 border border-red-500/20">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Wrench size={14} className="text-red-400" /> {t("admin.maintenanceMode")}
                </h3>
                {(() => {
                  const maintenanceSetting = appSettings.find((s: any) => s.key === "maintenance_mode");
                  const isActive = maintenanceSetting?.value === "true";
                  return (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-background/30">
                      <div>
                        <p className="text-xs font-medium">{isActive ? t("admin.maintenanceActive") : t("admin.appIsLive")}</p>
                        <p className="text-[10px] text-muted-foreground">{t("admin.maintenanceDesc")}</p>
                      </div>
                      <Button
                        size="sm"
                        className={cn("text-xs", isActive ? "bg-green-600 hover:bg-green-500 text-white" : "bg-red-600 hover:bg-red-500 text-white")}
                        onClick={() => {
                          updateSettingMutation.mutate({ key: "maintenance_mode", value: isActive ? "false" : "true" });
                          toast.success(isActive ? t("admin.maintenanceDisabled") : t("admin.maintenanceEnabled"), { icon: isActive ? "🟢" : "🔴" });
                        }}
                      >
                        {isActive ? t("common.disable") : t("common.enable")}
                      </Button>
                    </div>
                  );
                })()}
              </div>

              {/* Feature Flags */}
              <div className="card-elevated rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ToggleLeft size={14} className="text-secondary" /> {t("admin.featureFlags")}
                </h3>
                <div className="space-y-2">
                  {[
                    { key: "feature_swipe_enabled", label: t("admin.flag.swipeMatching"), desc: t("admin.flag.swipeMatchingDesc") },
                    { key: "feature_coaching_enabled", label: t("admin.flag.coachingSessions"), desc: t("admin.flag.coachingSessionsDesc") },
                    { key: "feature_groups_enabled", label: t("admin.flag.groupsCommunities"), desc: t("admin.flag.groupsCommunitiesDesc") },
                    { key: "feature_premium_enabled", label: t("admin.flag.premiumPurchases"), desc: t("admin.flag.premiumPurchasesDesc") },
                    { key: "feature_chat_enabled", label: t("admin.flag.chatMessaging"), desc: t("admin.flag.chatMessagingDesc") },
                  ].map(flag => {
                    const setting = appSettings.find((s: any) => s.key === flag.key);
                    const isEnabled = setting?.value !== "false"; // default enabled
                    return (
                      <div key={flag.key} className="flex items-center justify-between p-2 rounded-xl bg-background/30">
                        <div className="flex-1">
                          <p className="text-xs font-medium">{flag.label}</p>
                          <p className="text-[10px] text-muted-foreground">{flag.desc}</p>
                        </div>
                        <button
                          onClick={() => {
                            updateSettingMutation.mutate({ key: flag.key, value: isEnabled ? "false" : "true" });
                          }}
                          className="ml-3"
                        >
                          {isEnabled
                            ? <ToggleRight size={28} className="text-green-400" />
                            : <ToggleLeft size={28} className="text-muted-foreground/40" />
                          }
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Audit Log */}
      {activeTab === "auditLog" && (
        <div className="px-5 space-y-3">
          {reportsQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
          ) : reportsQuery.isError ? (
            <QueryError message={t("admin.loadAuditFailed")} onRetry={() => reportsQuery.refetch()} />
          ) : (
            <div className="card-elevated rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">{t("admin.recentReports")}</h3>
              {auditReports.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("admin.noReports")}</p>
              ) : (
                <div className="space-y-3">
                  {auditReports.map((entry: any) => (
                    <div key={entry.id} className="flex gap-3 p-2 rounded-xl bg-background/30">
                      <div className="w-1 rounded-full bg-secondary/50 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">{entry.reason || t("admin.report")}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Status: <span className={cn("font-medium", entry.status === "pending" ? "text-yellow-400" : "text-green-400")}>{entry.status}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: "text-green-400",
    blue: "text-blue-400",
    purple: "text-accent",
    yellow: "text-yellow-400",
  };
  return (
    <div className="card-elevated rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1 text-muted-foreground">{icon}<span className="text-[10px]">{label}</span></div>
      <p className={cn("text-xl font-bold", colorMap[color] || "text-foreground")}>{value}</p>
    </div>
  );
}

function ResourceBar({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  const getColor = (v: number) => v > 80 ? "bg-red-500" : v > 60 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-[10px]">{label}</span></div>
        <span className="text-[10px] font-medium">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", getColor(value))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}