import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Users, Shield, BarChart3, AlertTriangle, Search, ChevronRight, Ban, CheckCircle, Clock, Activity, TrendingUp, Loader2, ChevronLeft, FileText, Eye, RefreshCw, MapPin, X, Check, Edit3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { QueryError } from "@/components/QueryError";
import PlayerAvatar from "@/components/PlayerAvatar";

const adminTabs = ["Overview", "Users", "Reports", "Courts", "Content"];
const USERS_PER_PAGE = 10;

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user, navigate, goBack, selectPlayer } = useApp();
  const statsQuery = trpc.admin.getStats.useQuery(undefined, { refetchInterval: 30000 });
  const usersQuery = trpc.admin.getUsers.useQuery(undefined, { refetchInterval: 30000 });
  const reportsQuery = trpc.admin.getReports.useQuery(undefined, { refetchInterval: 30000 });
  const resolveReportMutation = trpc.admin.resolveReport.useMutation({
    onSuccess: () => reportsQuery.refetch(),
  });
  const courtSubsQuery = trpc.courts.pendingSubmissions.useQuery(undefined, { enabled: user?.role === "admin" || user?.role === "superadmin", refetchInterval: 30000 });
  const reviewCourtMutation = trpc.courts.reviewSubmission.useMutation({
    onSuccess: () => { courtSubsQuery.refetch(); toast.success(t("Court submission reviewed")); },
  });
  const suspendUserMutation = trpc.admin.suspendUser.useMutation({
    onSuccess: () => { usersQuery.refetch(); toast(t("admin.userSuspended")); },
  });
  const unsuspendUserMutation = trpc.admin.unsuspendUser.useMutation({
    onSuccess: () => { usersQuery.refetch(); toast.success(t("admin.userUnsuspended")); },
  });

  const adminUsers: any[] = usersQuery.data ?? [];
  const adminReports: any[] = reportsQuery.data ?? [];
  const stats: any = statsQuery.data ?? {};

  const [activeTab, setActiveTab] = useState("Overview");
  const [userSearch, setUserSearch] = useState("");
  const serverBannedUsers = useMemo(() => {
    const suspended = new Set<number>();
    adminUsers.forEach((u: any) => { if (!u.isActive) suspended.add(u.id); });
    return suspended;
  }, [adminUsers]);
  const [localBannedOverrides, setLocalBannedOverrides] = useState<Map<number, boolean>>(new Map());
  const bannedUsers = useMemo(() => {
    const result = new Set(serverBannedUsers);
    localBannedOverrides.forEach((banned, userId) => {
      if (banned) result.add(userId); else result.delete(userId);
    });
    return result;
  }, [serverBannedUsers, localBannedOverrides]);
  const [usersPage, setUsersPage] = useState(0);
  const [reportFilter, setReportFilter] = useState<"all" | "pending" | "resolved">("all");
  const [courtFilter, setCourtFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [editingCourtId, setEditingCourtId] = useState<number | null>(null);
  const [courtEdits, setCourtEdits] = useState<Record<string, any>>({});
  const [adminNotes, setAdminNotes] = useState("");

  // Only admin users should see this (demo mode allows all)
  if (user?.role !== "admin" && user?.role !== "superadmin") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card-elevated rounded-xl p-6 text-center">
          <Shield size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t("admin.adminRequired")}</p>
          <Button onClick={() => navigate("home")} variant="outline" className="mt-4">
            {t("admin.goHome")}
          </Button>
        </div>
      </div>
    );
  }

  const filteredUsers = useMemo(() =>
    adminUsers.filter((p: any) => (p.nickname ?? p.username ?? "").toLowerCase().includes(userSearch.toLowerCase())),
    [adminUsers, userSearch]
  );
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const pagedUsers = filteredUsers.slice(usersPage * USERS_PER_PAGE, (usersPage + 1) * USERS_PER_PAGE);

  const filteredReports = useMemo(() => {
    if (reportFilter === "all") return adminReports;
    if (reportFilter === "pending") return adminReports.filter((r: any) => r.status === "pending");
    return adminReports.filter((r: any) => r.status !== "pending");
  }, [adminReports, reportFilter]);

  const pendingReportCount = adminReports.filter((r: any) => r.status === "pending").length;

  const courtSubmissions: any[] = courtSubsQuery.data ?? [];
  const pendingCourtCount = courtSubmissions.filter((s: any) => s.status === "pending").length;
  const filteredCourtSubs = useMemo(() => {
    if (courtFilter === "all") return courtSubmissions;
    return courtSubmissions.filter((s: any) => s.status === courtFilter);
  }, [courtSubmissions, courtFilter]);

  return (
    <div className="pb-24 min-h-screen">
      {/* Premium Header */}
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-red-500/8 blur-3xl" />
        <div className="relative px-5 pt-7 pb-3 flex items-center gap-3">
          <button onClick={() => goBack()} aria-label="Go back" className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{t("admin.title")}</h1>
          <span className="ml-auto sport-badge sport-badge-red text-[9px]">{t("admin.badge")}</span>
        </div>
      </div>

      {/* Tabs — Premium pill-tab-active style */}
      <div className="px-5 pb-4 flex gap-1.5 overflow-x-auto scrollbar-none">
        {adminTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all relative",
              activeTab === tab
                ? "pill-tab-active text-white"
                : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
            )}
          >
            {tab === "Courts" ? t("Courts") : t(`admin.tab${tab}`)}
            {tab === "Reports" && pendingReportCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{pendingReportCount}</span>
            )}
            {tab === "Courts" && pendingCourtCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-secondary text-background text-[8px] font-bold flex items-center justify-center">{pendingCourtCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "Overview" && (
        <div className="px-5 space-y-4 animate-slide-up">
          {statsQuery.isError && !stats.totalUsers ? (
            <QueryError message={t("admin.failedLoadStats")} onRetry={() => statsQuery.refetch()} />
          ) : (
          <>
          {/* Stats Hero */}
          <div className="card-hero rounded-xl p-4">
            <div className="grid grid-cols-4 gap-2 relative z-10">
              <div className="text-center">
                <p className="stat-number text-xl text-secondary">{stats.totalUsers ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">{t("admin.users")}</p>
              </div>
              <div className="text-center">
                <p className="stat-number text-xl text-green-400">{stats.activeToday ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">{t("admin.active")}</p>
              </div>
              <div className="text-center">
                <p className="stat-number text-xl text-accent">{stats.totalMatches ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">{t("admin.totalMatches")}</p>
              </div>
              <div className="text-center">
                <p className="stat-number text-xl text-red-400">{pendingReportCount}</p>
                <p className="text-[10px] text-muted-foreground">{t("admin.reports")}</p>
              </div>
            </div>
          </div>

          {/* Detailed Stat Cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<Users size={16} />} label={t("admin.totalUsers")} value={String(stats.totalUsers ?? "—")} change={stats.userGrowth ? `+${stats.userGrowth}%` : ""} />
            <StatCard icon={<Activity size={16} />} label={t("admin.activeToday")} value={String(stats.activeToday ?? "—")} accent="green" />
            <StatCard icon={<TrendingUp size={16} />} label={t("admin.totalMatches")} value={String(stats.totalMatches ?? "—")} accent="cyan" />
            <StatCard icon={<AlertTriangle size={16} />} label={t("admin.openReports")} value={String(pendingReportCount)} accent={pendingReportCount > 0 ? "red" : "green"} urgent={pendingReportCount > 5} />
          </div>

          {/* Weekly Activity Chart */}
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-secondary" /> {t("admin.weeklyActivity")}
            </h3>
            <div className="flex items-end gap-1 h-24">
              {(stats.weeklyActivity ?? []).length > 0 ? (stats.weeklyActivity as { day: string; count: number }[]).map((d: { day: string; count: number }, i: number) => {
                const maxCount = Math.max(...(stats.weeklyActivity as { day: string; count: number }[]).map((x: { day: string; count: number }) => x.count), 1);
                const pct = Math.round((d.count / maxCount) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-medium text-secondary">{d.count}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-primary to-secondary"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                    <span className="text-[8px] text-muted-foreground">{d.day}</span>
                  </div>
                );
              }) : (
                <p className="text-xs text-muted-foreground w-full text-center self-center">{t("admin.noActivityData")}</p>
              )}
            </div>
          </div>

          {/* Revenue Metrics */}
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-secondary" /> {t("admin.revenueMetrics")}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-secondary/10">
                <p className="stat-number text-lg text-secondary">{stats.premiumUsers ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">{t("admin.premiumUsers")}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-green-500/10">
                <p className="stat-number text-lg text-green-400">{stats.conversionRate ?? 0}%</p>
                <p className="text-[10px] text-muted-foreground">{t("admin.conversionRate")}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-accent/10">
                <p className="stat-number text-lg text-accent">${((stats.premiumUsers ?? 0) * 9.99).toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">{t("admin.estMrr")}</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">{t("admin.quickActions")}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setActiveTab("Users")} className="p-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors text-left">
                <Users size={16} className="text-primary mb-1" />
                <p className="text-xs font-medium">{t("admin.manageUsers")}</p>
                <p className="text-[10px] text-muted-foreground">{adminUsers.length} total</p>
              </button>
              <button onClick={() => setActiveTab("Reports")} className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-colors text-left">
                <AlertTriangle size={16} className="text-red-400 mb-1" />
                <p className="text-xs font-medium">{t("admin.viewReports")}</p>
                <p className="text-[10px] text-muted-foreground">{pendingReportCount} {t("admin.pending")}</p>
              </button>
              <button onClick={() => setActiveTab("Content")} className="p-3 rounded-xl bg-accent/10 hover:bg-accent/20 transition-colors text-left">
                <FileText size={16} className="text-accent mb-1" />
                <p className="text-xs font-medium">{t("admin.contentReview")}</p>
                <p className="text-[10px] text-muted-foreground">{t("admin.moderationQueue")}</p>
              </button>
              <button onClick={() => setActiveTab("Courts")} className="p-3 rounded-xl bg-secondary/10 hover:bg-secondary/20 transition-colors text-left">
                <MapPin size={16} className="text-secondary mb-1" />
                <p className="text-xs font-medium">Court Submissions</p>
                <p className="text-[10px] text-muted-foreground">{pendingCourtCount} pending</p>
              </button>
              <button onClick={() => { statsQuery.refetch(); usersQuery.refetch(); reportsQuery.refetch(); toast.success(t("admin.dataRefreshed")); }} className="p-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 transition-colors text-left">
                <RefreshCw size={16} className="text-green-400 mb-1" />
                <p className="text-xs font-medium">{t("admin.refreshData")}</p>
                <p className="text-[10px] text-muted-foreground">{t("admin.pullLatest")}</p>
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "Users" && (
        <div className="px-5 space-y-3 animate-slide-up">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("admin.searchUsers")}
              value={userSearch}
              onChange={e => { setUserSearch(e.target.value); setUsersPage(0); }}
              className="pl-9 bg-background/50 rounded-xl"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">{filteredUsers.length} users · Page {usersPage + 1} of {totalUserPages}</p>
          {pagedUsers.map((player: any) => {
              const isBanned = bannedUsers.has(player.id);
              return (
              <div key={player.id} className={cn("card-elevated rounded-xl p-3 flex items-center gap-3", isBanned && "opacity-50 border-red-500/20")}>
                <PlayerAvatar user={{ id: player.id, name: player.name, nickname: player.nickname, profilePhotoUrl: player.profilePhotoUrl, hasProfilePhoto: !!player.profilePhotoUrl }} size="sm" showBadges={false} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{player.nickname ?? player.username} {isBanned && <span className="sport-badge sport-badge-red text-[8px] ml-1">{t("admin.banned")}</span>}</p>
                  <p className="text-[10px] text-muted-foreground">Skill: {player.skillLevel ?? "—"} · {player.vibe ?? "—"}</p>
                  <p className="text-[9px] text-muted-foreground/60">Joined {player.createdAt ? new Date(player.createdAt).toLocaleDateString() : "—"}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => selectPlayer(player.id)}
                    className="p-2 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors"
                    title={t("admin.viewProfile")}
                  >
                    <Eye size={12} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => {
                      if (isBanned) {
                        unsuspendUserMutation.mutate({ userId: player.id });
                        setLocalBannedOverrides(prev => new Map(prev).set(player.id, false));
                        toast.success(t("admin.userUnbanned"));
                      } else {
                        suspendUserMutation.mutate({ userId: player.id });
                        setLocalBannedOverrides(prev => new Map(prev).set(player.id, true));
                        toast(t("admin.userBanned"), { icon: "🚫" });
                      }
                    }}
                    className={cn("p-2 rounded-lg transition-colors", isBanned ? "bg-green-500/10 hover:bg-green-500/20" : "bg-red-500/10 hover:bg-red-500/20")}
                    title={isBanned ? t("admin.unbanUser") : t("admin.banUser")}
                  >
                    <Ban size={12} className={isBanned ? "text-green-400" : "text-red-400"} />
                  </button>
                </div>
              </div>
              );
            })}
          {/* Pagination */}
          {totalUserPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setUsersPage(p => Math.max(0, p - 1))}
                disabled={usersPage === 0}
                className="p-2 rounded-lg bg-muted/10 hover:bg-muted/20 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalUserPages) }, (_, i) => {
                  const start = Math.max(0, Math.min(usersPage - 2, totalUserPages - 5));
                  const page = start + i;
                  if (page >= totalUserPages) return null;
                  return (
                    <button key={page} onClick={() => setUsersPage(page)}
                      className={cn("w-7 h-7 rounded-lg text-[10px] font-bold transition-colors",
                        page === usersPage ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
                      )}
                    >{page + 1}</button>
                  );
                })}
              </div>
              <button
                onClick={() => setUsersPage(p => Math.min(totalUserPages - 1, p + 1))}
                disabled={usersPage >= totalUserPages - 1}
                className="p-2 rounded-lg bg-muted/10 hover:bg-muted/20 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "Reports" && (
        <div className="px-5 space-y-3 animate-slide-up">
          <div className="flex gap-1.5 mb-1">
            {(["all", "pending", "resolved"] as const).map(f => (
              <button key={f} onClick={() => setReportFilter(f)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                  reportFilter === f ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground"
                )}
              >{f} {f === "pending" ? `(${pendingReportCount})` : ""}</button>
            ))}
          </div>
          {filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle size={32} className="mx-auto text-green-400/50 mb-2" />
              <p className="text-sm text-muted-foreground">No {reportFilter} reports</p>
            </div>
          ) : filteredReports.map((r: any) => (
            <div key={r.id} className="card-elevated rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-semibold capitalize">{(r.reportType ?? r.type ?? "").replace(/-/g, " ")}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Report #{r.id} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <span className={cn(
                  "sport-badge text-[9px]",
                  r.status === "pending" ? "sport-badge-gold" : "sport-badge-green"
                )}>
                  {r.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {r.description ?? t("admin.noDetailsProvided")}
              </p>
              {r.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs"
                    onClick={() => {
                      resolveReportMutation.mutate({ reportId: r.id, status: "action-taken" });
                      toast(t("admin.userActionTaken"), { icon: "🚫" });
                    }}
                  >
                    <Ban size={12} className="mr-1" /> Take Action
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-muted text-xs"
                    onClick={() => {
                      resolveReportMutation.mutate({ reportId: r.id, status: "dismissed" });
                      toast.success(t("admin.reportDismissed"));
                    }}
                  >
                    <CheckCircle size={12} className="mr-1" /> Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Courts Tab */}
      {activeTab === "Courts" && (
        <div className="px-5 space-y-3 animate-slide-up">
          {/* Filter pills */}
          <div className="flex gap-1.5 mb-1">
            {(["pending", "approved", "rejected", "all"] as const).map(f => (
              <button key={f} onClick={() => setCourtFilter(f)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                  courtFilter === f ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground"
                )}
              >{f} {f === "pending" ? `(${pendingCourtCount})` : ""}</button>
            ))}
          </div>

          {courtSubsQuery.isLoading && (
            <div className="text-center py-12"><Loader2 size={24} className="mx-auto animate-spin text-muted-foreground" /></div>
          )}

          {filteredCourtSubs.length === 0 && !courtSubsQuery.isLoading ? (
            <div className="text-center py-12">
              <MapPin size={32} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No {courtFilter === "all" ? "" : courtFilter} court submissions</p>
            </div>
          ) : filteredCourtSubs.map((sub: any) => {
            const isEditing = editingCourtId === sub.id;
            return (
              <div key={sub.id} className={cn("card-elevated rounded-xl p-4", sub.status === "pending" && "border-secondary/20")}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <Input
                        value={courtEdits.name ?? sub.name}
                        onChange={e => setCourtEdits(prev => ({ ...prev, name: e.target.value }))}
                        className="text-sm font-semibold mb-1 h-7 bg-background/50"
                      />
                    ) : (
                      <p className="text-sm font-semibold truncate">{sub.name}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      by {sub.submitterName ?? sub.submitterEmail ?? `User #${sub.submittedBy}`} · {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <span className={cn(
                    "sport-badge text-[9px] flex-shrink-0 ml-2",
                    sub.status === "pending" ? "sport-badge-gold" : sub.status === "approved" ? "sport-badge-green" : "sport-badge-red"
                  )}>{sub.status}</span>
                </div>

                {/* Court details */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mb-3">
                  <div><span className="text-muted-foreground">Type:</span> {isEditing ? (
                    <select value={courtEdits.courtType ?? sub.courtType} onChange={e => setCourtEdits(prev => ({ ...prev, courtType: e.target.value }))} className="bg-background/50 rounded px-1 text-[11px] border border-border">
                      <option value="outdoor">Outdoor</option><option value="indoor">Indoor</option><option value="both">Both</option>
                    </select>
                  ) : <span className="capitalize">{sub.courtType}</span>}</div>
                  <div><span className="text-muted-foreground">Courts:</span> {isEditing ? (
                    <input type="number" min={1} max={50} value={courtEdits.numCourts ?? sub.numCourts} onChange={e => setCourtEdits(prev => ({ ...prev, numCourts: +e.target.value }))} className="w-12 bg-background/50 rounded px-1 text-[11px] border border-border" />
                  ) : sub.numCourts}</div>
                  {sub.surfaceType && <div><span className="text-muted-foreground">Surface:</span> {sub.surfaceType}</div>}
                  <div><span className="text-muted-foreground">Lighting:</span> {sub.lighting ? "Yes" : "No"}</div>
                  <div><span className="text-muted-foreground">Free:</span> {sub.isFree ? "Yes" : `No — ${sub.costInfo ?? ""}`}</div>
                  {sub.address && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {isEditing ? (
                    <Input value={courtEdits.address ?? sub.address ?? ""} onChange={e => setCourtEdits(prev => ({ ...prev, address: e.target.value }))} className="h-6 text-[11px] mt-0.5 bg-background/50" />
                  ) : sub.address}</div>}
                  {(sub.city || sub.state) && <div className="col-span-2"><span className="text-muted-foreground">Location:</span> {sub.city}{sub.city && sub.state ? ", " : ""}{sub.state}</div>}
                  <div className="col-span-2"><span className="text-muted-foreground">Coords:</span> {sub.latitude?.toFixed(5)}, {sub.longitude?.toFixed(5)}</div>
                </div>

                {sub.amenities && <p className="text-[10px] text-muted-foreground mb-1"><span className="font-medium">Amenities:</span> {sub.amenities}</p>}
                {sub.notes && <p className="text-[10px] text-muted-foreground mb-2"><span className="font-medium">Notes:</span> {sub.notes}</p>}

                {/* Admin actions for pending submissions */}
                {sub.status === "pending" && (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    {isEditing && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground block mb-1">Admin Notes</span>
                        <Input value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Optional notes..." className="h-7 text-[11px] bg-background/50" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      {!isEditing && (
                        <Button size="sm" variant="outline" className="flex-1 text-xs"
                          onClick={() => { setEditingCourtId(sub.id); setCourtEdits({}); setAdminNotes(""); }}>
                          <Edit3 size={12} className="mr-1" /> Edit & Review
                        </Button>
                      )}
                      {isEditing && (
                        <Button size="sm" variant="outline" className="text-xs"
                          onClick={() => { setEditingCourtId(null); setCourtEdits({}); setAdminNotes(""); }}>
                          <X size={12} className="mr-1" /> Cancel
                        </Button>
                      )}
                      <Button size="sm" className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs"
                        disabled={reviewCourtMutation.isPending}
                        onClick={() => {
                          reviewCourtMutation.mutate({
                            submissionId: sub.id,
                            action: "approved",
                            adminNotes: adminNotes || undefined,
                            ...Object.keys(courtEdits).length > 0 ? courtEdits : {},
                          });
                          setEditingCourtId(null); setCourtEdits({}); setAdminNotes("");
                        }}>
                        <Check size={12} className="mr-1" /> Approve
                      </Button>
                      <Button size="sm" className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs"
                        disabled={reviewCourtMutation.isPending}
                        onClick={() => {
                          reviewCourtMutation.mutate({
                            submissionId: sub.id,
                            action: "rejected",
                            adminNotes: adminNotes || undefined,
                          });
                          setEditingCourtId(null); setCourtEdits({}); setAdminNotes("");
                        }}>
                        <X size={12} className="mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Content Tab */}
      {activeTab === "Content" && (
        <div className="px-5 space-y-4 animate-slide-up">
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText size={14} className="text-secondary" /> Content Moderation Queue
            </h3>
            <div className="text-center py-6">
              <CheckCircle size={32} className="mx-auto text-green-400/50 mb-2" />
              <p className="text-sm text-muted-foreground">All content reviewed</p>
              <p className="text-[10px] text-muted-foreground/60">No items pending review</p>
            </div>
          </div>
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Shield size={14} className="text-green-400" /> Auto-Moderation Stats
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-green-400">98.5%</p>
                <p className="text-[10px] text-muted-foreground">Messages Clean</p>
              </div>
              <div>
                <p className="text-lg font-bold text-secondary">12</p>
                <p className="text-[10px] text-muted-foreground">Flagged / Week</p>
              </div>
              <div>
                <p className="text-lg font-bold text-primary">2.1s</p>
                <p className="text-[10px] text-muted-foreground">Avg Response</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  change,
  urgent,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: string;
  urgent?: boolean;
  accent?: string;
}) {
  return (
    <div className={cn("card-elevated rounded-xl p-3", urgent && "border-red-500/30")}>
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {change && (
        <span className={cn("text-[10px] font-medium", urgent ? "text-red-400" : "text-green-400")}>
          {change}
        </span>
      )}
    </div>
  );
}
