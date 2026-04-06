import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Plus, Globe, Lock, Search, Loader2, ChevronRight,
  MessageCircle, CalendarPlus, Send, Trophy, BarChart3, Flame, Target,
  Crown, Star, Zap, Settings, Shield, ShieldCheck, UserMinus, MoreVertical,
  Pencil, Check, X, Megaphone, ChevronDown, Camera, UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { QueryError } from "@/components/QueryError";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getLevelInfo, getTierColor } from "@/lib/gamification";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useQueryClient } from "@tanstack/react-query";
import InvitePickerModal from "@/components/InvitePickerModal";

const groupTypes = ["All", "Social", "League", "Tournament", "Coaching"] as const;
const groupTypeIcons: Record<string, string> = {
  social: "🎉",
  league: "🏆",
  tournament: "⚔️",
  coaching: "🎓",
};

export default function GroupsScreen() {
  const { user, navigate, goBack, selectPlayer, setCreateGameGroupId, selectGame } = useApp();
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<string>("All");
  const [groupView, setGroupView] = useState<"all" | "mine">("mine");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"social" | "league" | "tournament" | "coaching">("social");
  const [newPrivate, setNewPrivate] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [newPhoto, setNewPhoto] = useState("");
  const newPhotoInputRef = useRef<HTMLInputElement>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "games" | "leaderboard" | "manage">("chat");
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Member management state
  const [memberMenuOpen, setMemberMenuOpen] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "kick" | "promote" | "demote"; userId: number; name: string } | null>(null);

  // Group editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Announcement state
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");

  // Invite state
  const [showGroupInvite, setShowGroupInvite] = useState(false);

  const typeFilter = activeType === "All" ? undefined : activeType.toLowerCase() as any;
  const groupsQuery = trpc.groups.list.useQuery({ type: typeFilter }, { enabled: groupView === "all", refetchInterval: 30000 });
  const myGroupsQuery = trpc.groups.myGroups.useQuery(undefined, { enabled: groupView === "mine", refetchInterval: 30000 });
  const groups: any[] = groupView === "mine" ? (myGroupsQuery.data ?? []) : (groupsQuery.data ?? []);
  const activeGroupsQuery = groupView === "mine" ? myGroupsQuery : groupsQuery;

  const membersQuery = trpc.groups.getMembers.useQuery(
    { groupId: selectedGroupId! },
    { enabled: !!selectedGroupId, refetchInterval: 30000 }
  );

  // Fetch group detail independently so it's always available even if the list hasn't loaded
  const groupDetailQuery = trpc.groups.getById.useQuery(
    { groupId: selectedGroupId! },
    { enabled: !!selectedGroupId, refetchInterval: 30000 }
  );

  const leaderboardQuery = trpc.groups.getLeaderboard.useQuery(
    { groupId: selectedGroupId! },
    { enabled: !!selectedGroupId && activeTab === "leaderboard", refetchInterval: 30000 }
  );
  const leaderboard: any[] = leaderboardQuery.data ?? [];

  // Group chat — prefer the detail query for guaranteed data, fall back to list
  const selectedGroup = groupDetailQuery.data ?? groups.find((g: any) => g.id === selectedGroupId);
  const groupConversationId = selectedGroup?.conversationId;

  // isMember is computed below but we need it for query gating — derive from membersQuery data
  const isMemberForQuery = (membersQuery.data ?? []).some((m: any) => m.userId === user?.id && m.status === "active");

  // Group games query — shows all games linked to this group
  const groupGamesQuery = trpc.games.listByGroup.useQuery(
    { groupId: selectedGroupId! },
    { enabled: !!selectedGroupId && activeTab === "games" && isMemberForQuery, refetchInterval: 30000 }
  );
  const groupGames: any[] = groupGamesQuery.data ?? [];

  const chatQuery = trpc.chat.getMessages.useQuery(
    { conversationId: groupConversationId!, limit: 100 },
    { enabled: !!groupConversationId && activeTab === "chat" && isMemberForQuery, refetchInterval: 15000 }
  );
  const groupMessages: any[] = chatQuery.data ?? [];

  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setChatMessage("");
      chatQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const markReadMutation = trpc.chat.markRead.useMutation();
  const markReadRef = useRef(markReadMutation.mutate);
  markReadRef.current = markReadMutation.mutate;

  useEffect(() => {
    if (groupConversationId && activeTab === "chat" && isMemberForQuery) {
      markReadRef.current({ conversationId: groupConversationId });
    }
  }, [groupConversationId, activeTab, isMemberForQuery]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupMessages.length]);

  // Real-time WebSocket integration: receive new messages instantly instead of polling
  const queryClient = useQueryClient();
  useChatSocket({
    conversationId: (activeTab === "chat" && isMemberForQuery) ? groupConversationId : null,
    userId: user?.id,
    onNewMessage: useCallback(() => {
      // Refetch the chat query immediately when a new message arrives
      chatQuery.refetch();
    }, [chatQuery]),
  });

  const createMutation = trpc.groups.create.useMutation({
    onSuccess: (data: any) => {
      toast.success(t("groups.groupCreated"));
      groupsQuery.refetch(); myGroupsQuery.refetch();
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      setNewCity("");
      setNewPhoto("");
      // Navigate into the new group immediately
      if (data?.groupId) {
        setGroupView("mine");
        setSelectedGroupId(data.groupId);
        setActiveTab("chat");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const joinMutation = trpc.groups.join.useMutation({
    onSuccess: (data: any) => {
      toast.success(data?.status === "active" ? t("groups.joinedGroup", "Joined group!") : t("groups.requestSent"));
      groupsQuery.refetch(); myGroupsQuery.refetch();
      if (selectedGroupId) { membersQuery.refetch(); groupDetailQuery.refetch(); }
    },
    onError: (e) => toast.error(e.message),
  });

  const leaveMutation = trpc.groups.leave.useMutation({
    onSuccess: () => {
      toast(t("groups.leftGroup"));
      groupsQuery.refetch(); myGroupsQuery.refetch();
      if (selectedGroupId) { membersQuery.refetch(); groupDetailQuery.refetch(); }
    },
    onError: (e) => toast.error(e.message),
  });

  // New mutations for group management
  const updateGroupMutation = trpc.groups.update.useMutation({
    onSuccess: () => {
      toast.success(t("groups.groupUpdated"));
      groupsQuery.refetch(); myGroupsQuery.refetch(); groupDetailQuery.refetch();
      setIsEditing(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRoleMutation = trpc.groups.updateMemberRole.useMutation({
    onSuccess: () => {
      toast.success(t("groups.roleUpdated"));
      membersQuery.refetch();
      setMemberMenuOpen(null);
      setConfirmAction(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMemberMutation = trpc.groups.removeMember.useMutation({
    onSuccess: () => {
      toast.success(t("groups.memberRemoved"));
      membersQuery.refetch(); groupsQuery.refetch(); myGroupsQuery.refetch(); groupDetailQuery.refetch();
      setMemberMenuOpen(null);
      setConfirmAction(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMemberMutation = trpc.groups.approveMember.useMutation({
    onSuccess: () => {
      toast.success(t("groups.memberApproved"));
      membersQuery.refetch(); groupsQuery.refetch(); myGroupsQuery.refetch(); groupDetailQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const declineMemberMutation = trpc.groups.declineMember.useMutation({
    onSuccess: () => {
      toast(t("groups.memberDeclined"));
      membersQuery.refetch(); groupsQuery.refetch(); groupDetailQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = groups.filter((g: any) =>
    g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  // Detail view
  if (selectedGroupId) {
    const group = groupDetailQuery.data ?? groups.find((g: any) => g.id === selectedGroupId);
    const members: any[] = membersQuery.data ?? [];
    const isMember = members.some((m: any) => m.userId === user?.id && m.status === "active");
    const isPending = members.some((m: any) => m.userId === user?.id && m.status === "pending");
    const myRole = members.find((m: any) => m.userId === user?.id)?.role;
    const isAdmin = myRole === "admin";
    const isMod = myRole === "moderator";
    const canManage = isAdmin || isMod;

    const handleSendChat = () => {
      if (!chatMessage.trim() || !groupConversationId) return;
      sendMessageMutation.mutate({ conversationId: groupConversationId, content: chatMessage });
    };

    const handleSendAnnouncement = () => {
      if (!announcementText.trim() || !groupConversationId) return;
      const msg = `📢 ANNOUNCEMENT\n${announcementText}`;
      sendMessageMutation.mutate({ conversationId: groupConversationId, content: msg });
      setAnnouncementText("");
      setShowAnnouncement(false);
      toast.success(t("groups.announcementPosted"));
    };

    const startEditing = () => {
      setEditName(group?.name || "");
      setEditDesc(group?.description || "");
      setEditCity(group?.locationCity || "");
      setEditPhoto(group?.photo || "");
      setIsEditing(true);
    };

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast.error(t("common.fileTooLarge")); return; }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "group");
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        setEditPhoto(data.url);
        toast.success(t("common.photoUploaded"));
      } catch { toast.error(t("common.uploadFailed")); }
    };

    const saveEdit = () => {
      if (!editName.trim()) return;
      updateGroupMutation.mutate({
        groupId: selectedGroupId,
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        locationCity: editCity.trim() || undefined,
        photo: editPhoto || undefined,
      });
    };

    const handleRoleChange = (targetUserId: number, newRole: "admin" | "moderator" | "member") => {
      updateRoleMutation.mutate({ groupId: selectedGroupId, targetUserId, newRole });
    };

    const handleKick = (targetUserId: number) => {
      removeMemberMutation.mutate({ groupId: selectedGroupId, targetUserId });
    };

    // Weekly challenges
    const weekChallenges = [
      { title: t("groups.weeklyChallenge1Title"), icon: "🏓", desc: t("groups.weeklyChallenge1Desc") },
      { title: t("groups.weeklyChallenge2Title"), icon: "👋", desc: t("groups.weeklyChallenge2Desc") },
      { title: t("groups.weeklyChallenge3Title"), icon: "🌙", desc: t("groups.weeklyChallenge3Desc") },
      { title: t("groups.weeklyChallenge4Title"), icon: "🎯", desc: t("groups.weeklyChallenge4Desc") },
    ];
    const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const currentChallenge = weekChallenges[weekNum % weekChallenges.length];

    // Build tabs based on role — only Chat + Games + Leaderboard (+ Manage for admins)
    const tabs: { key: string; label: string; icon: any }[] = [
      { key: "chat", label: t("groups.tabChat"), icon: MessageCircle },
      { key: "games", label: t("groups.tabGames"), icon: CalendarPlus },
      { key: "leaderboard", label: t("groups.tabLeaderboard"), icon: Trophy },
    ];
    if (canManage) {
      tabs.push({ key: "manage", label: t("groups.tabManage"), icon: Settings });
    }

    const pendingMembers = members.filter((m: any) => m.status === "pending");

    return (
      <>
      <div className={cn("min-h-screen flex flex-col", activeTab !== "chat" && "pb-24")}>
        {/* Confirm Action Modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setConfirmAction(null)}>
            <div className="card-elevated rounded-2xl p-5 w-full max-w-sm space-y-3 animate-slide-up" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold">
                {confirmAction.type === "kick" ? t("groups.removeMember") : confirmAction.type === "promote" ? t("groups.promoteMember") : t("groups.demoteMember")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {confirmAction.type === "kick" && t("groups.confirmKick", { name: confirmAction.name })}
                {confirmAction.type === "promote" && t("groups.confirmPromote", { name: confirmAction.name })}
                {confirmAction.type === "demote" && t("groups.confirmDemote", { name: confirmAction.name })}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)} className="flex-1">{t("common.cancel")}</Button>
                <Button
                  size="sm"
                  className={cn("flex-1", confirmAction.type === "kick" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-gradient-to-r from-primary to-accent text-white")}
                  disabled={updateRoleMutation.isPending || removeMemberMutation.isPending}
                  onClick={() => {
                    if (confirmAction.type === "kick") handleKick(confirmAction.userId);
                    else if (confirmAction.type === "promote") handleRoleChange(confirmAction.userId, "moderator");
                    else handleRoleChange(confirmAction.userId, "member");
                  }}
                >
                  {(updateRoleMutation.isPending || removeMemberMutation.isPending) ? <Loader2 size={14} className="animate-spin" /> : t("groups.confirm")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative px-5 pt-7 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => { setSelectedGroupId(null); setActiveTab("chat"); setIsEditing(false); setMemberMenuOpen(null); setShowGroupInfo(false); }} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
                <ArrowLeft size={18} />
              </button>
              <button className="flex-1 min-w-0 text-left" onClick={() => setShowGroupInfo(!showGroupInfo)}>
                <div className="flex items-center gap-2">
                  {group?.photo ? (
                    <img src={group.photo} alt="" className="w-9 h-9 rounded-lg object-cover" />
                  ) : (
                    <span className="text-xl">{groupTypeIcons[group?.groupType] ?? "👥"}</span>
                  )}
                  <h1 className="text-lg font-bold truncate">{group?.name ?? "Group"}</h1>
                  <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", showGroupInfo && "rotate-180")} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {members.length} {t("groups.members")} · {group?.groupType}
                  {group?.locationCity && ` · ${group.locationCity}`}
                </p>
              </button>
              {group?.isPrivate && <Lock size={14} className="text-muted-foreground" />}
              {isAdmin && (
                <button onClick={startEditing} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
                  <Pencil size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Tabs */}
            {isMember && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                      activeTab === tab.key
                        ? "pill-tab-active text-white"
                        : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    <tab.icon size={13} />
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Non-member landing view: show group info + join button prominently */}
        {!isMember && !showGroupInfo && (
          <div className="px-5 pb-4 animate-slide-up">
            <div className="card-elevated rounded-xl p-5 space-y-4">
              {group?.photo && (
                <img src={group.photo} alt="" className="w-full h-32 rounded-lg object-cover" />
              )}
              {group?.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{group.description}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users size={12} className="text-primary" /> {members.filter((m: any) => m.status === "active").length} {t("groups.members")}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground capitalize">
                  <Trophy size={12} className="text-secondary" /> {group?.groupType}
                </div>
                {group?.locationCity && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe size={12} /> {group.locationCity}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  {group?.isPrivate ? <Lock size={12} /> : <Globe size={12} />} {group?.isPrivate ? t("groups.private") : t("groups.public")}
                </div>
              </div>

              {/* Members preview */}
              {members.filter((m: any) => m.status === "active").length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">{t("groups.members")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.filter((m: any) => m.status === "active").slice(0, 8).map((m: any) => (
                      <div key={m.userId} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/10">
                        <PlayerAvatar user={{ id: m.userId, profilePhotoUrl: m.profilePhotoUrl, hasProfilePhoto: m.hasProfilePhoto, name: m.name, nickname: m.nickname, gender: null }} size="sm" />
                        <span className="text-[10px] font-medium">{m.nickname || m.name}</span>
                        {m.role === "admin" && <span className="text-[8px]">👑</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isPending ? (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">⏳ {t("groups.pendingApproval", "Your join request is pending approval")}</p>
                </div>
              ) : (
                <Button
                  onClick={() => joinMutation.mutate({ groupId: group!.id })}
                  size="sm"
                  disabled={joinMutation.isPending}
                  className="w-full bg-gradient-to-r from-primary to-accent text-white"
                >
                  {joinMutation.isPending
                    ? <Loader2 size={14} className="animate-spin mr-1.5" />
                    : group?.isPrivate
                      ? <Lock size={14} className="mr-1.5" />
                      : <Users size={14} className="mr-1.5" />
                  }
                  {group?.isPrivate ? t("groups.requestToJoin") : t("groups.joinGroup", "Join Group")}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* EDIT GROUP MODAL */}
        {isEditing && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setIsEditing(false)}>
            <div className="card-elevated rounded-2xl p-5 w-full max-w-sm space-y-3 animate-slide-up" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Pencil size={14} className="text-primary" /> {t("groups.editGroup")}
              </h3>
              <div className="flex justify-center">
                <button onClick={() => photoInputRef.current?.click()} className="relative group">
                  {editPhoto ? (
                    <img src={editPhoto} alt="" className="w-20 h-20 rounded-xl object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-muted/20 flex items-center justify-center text-3xl">
                      {groupTypeIcons[group?.groupType] ?? "👥"}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={20} className="text-white" />
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </button>
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("groups.nameLabel")}</label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-background/50 mt-1" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("groups.descriptionLabel")}</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full mt-1 bg-background/50 border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("groups.cityLabel")}</label>
                  <Input value={editCity} onChange={e => setEditCity(e.target.value)} className="bg-background/50 mt-1" placeholder={t("groups.cityPlaceholder")} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="flex-1">Cancel</Button>
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-primary to-accent text-white"
                  disabled={!editName.trim() || updateGroupMutation.isPending}
                  onClick={saveEdit}
                >
                  {updateGroupMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : t("groups.saveChanges")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* GROUP INFO DROPDOWN (appears on header tap) */}
        {showGroupInfo && group && (
          <div className="px-5 pb-4 animate-slide-up">
            <div className="card-elevated rounded-xl p-4 space-y-3">
              {group.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{group.description}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users size={12} className="text-primary" /> {members.length} {t("groups.members")}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground capitalize">
                  <Trophy size={12} className="text-secondary" /> {group.groupType}
                </div>
                {group.locationCity && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe size={12} /> {group.locationCity}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  {group.isPrivate ? <Lock size={12} /> : <Globe size={12} />} {group.isPrivate ? t("groups.private") : t("groups.public")}
                </div>
              </div>

              {/* Members preview */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">{t("groups.members")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {members.filter((m: any) => m.status !== "pending").slice(0, 10).map((m: any) => (
                    <button key={m.userId} onClick={() => selectPlayer(m.userId)} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors">
                      <PlayerAvatar user={{ id: m.userId, profilePhotoUrl: m.profilePhotoUrl, hasProfilePhoto: m.hasProfilePhoto, name: m.name, nickname: m.nickname, gender: null }} size="sm" />
                      <span className="text-[10px] font-medium">{m.nickname || m.name}</span>
                      {m.role === "admin" && <span className="text-[8px]">👑</span>}
                    </button>
                  ))}
                  {members.filter((m: any) => m.status !== "pending").length > 10 && (
                    <span className="text-[10px] text-muted-foreground px-2 py-1">+{members.filter((m: any) => m.status !== "pending").length - 10} more</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {isMember ? (
                  <Button onClick={() => leaveMutation.mutate({ groupId: group.id })} variant="outline" size="sm" disabled={leaveMutation.isPending}
                    className="border-red-400/30 text-red-400 hover:bg-red-500/10 text-xs">
                    {leaveMutation.isPending ? t("groups.leaving") : t("groups.leaveGroup")}
                  </Button>
                ) : (
                  <Button onClick={() => joinMutation.mutate({ groupId: group.id })} size="sm" disabled={joinMutation.isPending}
                    className="bg-gradient-to-r from-primary to-accent text-white text-xs">
                    {joinMutation.isPending ? t("groups.requesting") : t("groups.requestToJoin")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PENDING MEMBERS (admin only) */}
        {canManage && pendingMembers.length > 0 && (
          <div className="px-5 pb-3">
            <div className="card-elevated rounded-xl p-3 border-amber-400/20 bg-amber-400/5">
              <h3 className="text-xs font-bold flex items-center gap-1.5 mb-2">
                <span className="text-amber-400">⏳</span> {t("groups.pendingRequests", { count: pendingMembers.length })}
              </h3>
              <div className="space-y-2">
                {pendingMembers.map((m: any) => (
                  <div key={m.userId} className="flex items-center gap-2.5">
                    <PlayerAvatar user={{ id: m.userId, profilePhotoUrl: m.profilePhotoUrl, hasProfilePhoto: m.hasProfilePhoto, name: m.name, nickname: m.nickname, gender: null }} size="xs" />
                    <span className="text-sm font-medium flex-1 truncate">{m.nickname || m.name || `User #${m.userId}`}</span>
                    <button onClick={() => approveMemberMutation.mutate({ groupId: selectedGroupId, userId: m.userId })}
                      disabled={approveMemberMutation.isPending}
                      className="p-1.5 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-400 transition-colors">
                      <Check size={14} />
                    </button>
                    <button onClick={() => declineMemberMutation.mutate({ groupId: selectedGroupId, userId: m.userId })}
                      disabled={declineMemberMutation.isPending}
                      className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GROUP CHAT TAB */}
        {activeTab === "chat" && isMember && (
          <div className="flex-1 flex flex-col px-5">
            {!groupConversationId ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p>Group chat not available yet.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0">
                  {chatQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin" size={20} /></div>
                  ) : groupMessages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      <p>{t("groups.noMessagesYet")}</p>
                    </div>
                  ) : (
                    groupMessages.map((msg: any) => {
                      const isMe = msg.senderId === user?.id;
                      const isAnnouncement = msg.content?.startsWith("📢 ANNOUNCEMENT");
                      return (
                        <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[75%] rounded-2xl px-3.5 py-2.5",
                            isAnnouncement
                              ? "bg-gradient-to-br from-secondary/20 to-orange-500/10 border border-secondary/30 max-w-[90%]"
                              : isMe ? "bg-gradient-to-br from-primary to-accent text-white" : "card-elevated"
                          )}>
                            {!isMe && !isAnnouncement && <p className="text-[10px] font-bold text-primary mb-0.5">{msg.senderName || "Unknown"}</p>}
                            {isAnnouncement && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <Megaphone size={12} className="text-secondary" />
                                <span className="text-[10px] font-bold text-secondary uppercase tracking-wide">{t("groups.announcement")}</span>
                              </div>
                            )}
                            <p className={cn("text-sm leading-relaxed", isAnnouncement && "whitespace-pre-line")}>
                              {isAnnouncement ? msg.content.replace("📢 ANNOUNCEMENT\n", "") : msg.content}
                            </p>
                            <p className={cn("text-[9px] mt-1",
                              isAnnouncement ? "text-secondary/50" : isMe ? "text-white/50" : "text-muted-foreground/60"
                            )}>
                              {!isMe && isAnnouncement && <span className="font-medium">{msg.senderName} · </span>}
                              {new Date(msg.sentAt).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>
                {/* Announcement form (admin only) */}
                {showAnnouncement && canManage && (
                  <div className="mb-2 space-y-2 animate-slide-up">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-secondary flex items-center gap-1"><Megaphone size={12} /> {t("groups.announcement")}</span>
                      <button onClick={() => setShowAnnouncement(false)} className="text-[10px] text-muted-foreground">Cancel</button>
                    </div>
                    <textarea value={announcementText} onChange={e => setAnnouncementText(e.target.value)}
                      placeholder={t("groups.announcementPlaceholder")} rows={2}
                      className="w-full bg-background/50 border border-secondary/20 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-secondary" />
                    <Button onClick={handleSendAnnouncement} disabled={!announcementText.trim() || sendMessageMutation.isPending}
                      size="sm" className="w-full bg-gradient-to-r from-secondary to-orange-500 text-white">
                      <Megaphone size={14} className="mr-1.5" /> {sendMessageMutation.isPending ? t("groups.posting") : t("groups.postAnnouncement")}
                    </Button>
                  </div>
                )}
                <div className="flex gap-2 pb-24">
                  <Input
                    placeholder={t("groups.messagePlaceholder")}
                    value={chatMessage}
                    onChange={e => setChatMessage(e.target.value)}
                    className="bg-background/50 flex-1"
                    onKeyDown={e => e.key === "Enter" && handleSendChat()}
                  />
                  <Button onClick={handleSendChat} size="sm" disabled={!chatMessage.trim() || sendMessageMutation.isPending} className="bg-gradient-to-r from-primary to-accent text-white">
                    <Send size={16} />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* GAMES TAB */}
        {activeTab === "games" && isMember && (
          <div className="px-5 space-y-4 animate-slide-up">
            {/* Create Game Button */}
            <div className="card-neon rounded-xl p-4 text-center">
              <Button onClick={() => { setCreateGameGroupId(selectedGroupId); navigate("createGame"); }} className="bg-gradient-to-r from-primary to-accent text-white gap-2 shadow-[0_0_16px_rgba(168,85,247,0.2)]" size="sm">
                <CalendarPlus size={14} /> {t("groups.createGameBtn")}
              </Button>
            </div>

            {/* Group Games List */}
            {groupGamesQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" size={20} /></div>
            ) : groupGames.length === 0 ? (
              <div className="card-elevated rounded-xl p-6 text-center">
                <CalendarPlus size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("groups.noGroupGames", "No games yet. Create one to get started!")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupGames.map((game: any) => {
                  const isInProgress = game.status === "in-progress";
                  const isScheduled = game.status === "scheduled";
                  const isCompleted = game.status === "completed";
                  const confirmedCount = game.currentPlayers ?? 0;
                  return (
                    <div key={game.id} className={cn(
                      "card-elevated rounded-xl p-4 transition-all",
                      isInProgress && "border border-green-500/30 bg-green-500/5"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                            isInProgress ? "bg-green-500/20 text-green-400"
                              : isCompleted ? "bg-muted/30 text-muted-foreground"
                              : "bg-primary/20 text-primary"
                          )}>
                            {isInProgress ? "Live" : game.status}
                          </span>
                          <span className="text-xs text-muted-foreground">{game.gameType} · {game.format}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Users size={10} /> {confirmedCount}/{game.maxPlayers}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <CalendarPlus size={10} className="text-primary" />
                          {new Date(game.scheduledAt).toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <span>{new Date(game.scheduledAt).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}</span>
                        {game.locationName && <span className="truncate max-w-[120px]">{game.locationName}</span>}
                      </div>
                      {/* Participant avatars */}
                      <div className="flex items-center gap-1 mb-2">
                        {(game.participants ?? []).filter((p: any) => p.status === "confirmed").slice(0, 6).map((p: any, i: number) => (
                          <PlayerAvatar key={i} user={{ id: p.userId, name: p.name, profilePhotoUrl: p.profilePhotoUrl, hasProfilePhoto: !!p.profilePhotoUrl }} size="sm" showBadges={false} className="border-2 border-background -ml-1.5 first:ml-0" />
                        ))}
                      </div>
                      {/* Action button */}
                      {(isInProgress || isScheduled) && (
                        <button
                          onClick={() => selectGame(game.id)}
                          className={cn(
                            "w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-[0.97]",
                            isInProgress ? "bg-gradient-to-r from-green-600 to-green-500 text-white" : "bg-gradient-to-r from-primary to-secondary text-white"
                          )}
                        >
                          {isInProgress ? <><Trophy size={14} /> {t("gamePlay.continueGame", "Continue Game")}</> : <><CalendarPlus size={14} /> {t("gamePlay.startGame")}</>}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === "leaderboard" && isMember && (
          <div className="px-5 space-y-4 animate-slide-up">
            <div className="card-elevated rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center">
                  <Trophy size={13} className="text-secondary" />
                </div>
                {t("groups.leaderboard")}
              </h3>
              {leaderboardQuery.isLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
              ) : leaderboard.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("groups.noLeaderboardData")}</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((player: any, index: number) => {
                    const levelInfo = getLevelInfo(player.xp ?? 0);
                    const rankEmoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
                    return (
                      <div key={player.userId} className={cn("flex items-center gap-3 p-2.5 rounded-xl transition-colors", index < 3 ? "bg-secondary/5 border border-secondary/10" : "hover:bg-muted/10")}>
                        <div className="w-7 text-center">
                          {rankEmoji ? <span className="text-lg">{rankEmoji}</span> : <span className="text-xs font-bold text-muted-foreground">{index + 1}</span>}
                        </div>
                        <PlayerAvatar user={player} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{player.nickname || player.name || "Player"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            <span style={{ color: getTierColor(levelInfo.tier) }}>Lv.{levelInfo.level} {levelInfo.title}</span>
                            {player.currentStreak > 0 && <span className="ml-1.5">🔥 {player.currentStreak}</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-secondary">{(player.xp ?? 0).toLocaleString()} XP</p>
                          <p className="text-[9px] text-muted-foreground">{player.gamesPlayed ?? 0} {t("groups.tabGames")}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MANAGE TAB (Admin/Mod only) */}
        {activeTab === "manage" && canManage && (
          <div className="px-5 space-y-4 animate-slide-up">
            {/* Quick Actions */}
            <div className="card-elevated rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                  <Zap size={13} className="text-primary" />
                </div>
                {t("groups.quickActions")}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {isAdmin && (
                  <button
                    onClick={startEditing}
                    className="card-elevated rounded-xl p-3 text-left hover:scale-[1.02] transition-all"
                  >
                    <Pencil size={16} className="text-primary mb-1.5" />
                    <p className="text-xs font-bold">{t("groups.editGroupAction")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("groups.editGroupActionDesc")}</p>
                  </button>
                )}
                <button
                  onClick={() => { setShowAnnouncement(true); setActiveTab("chat"); }}
                  className="card-elevated rounded-xl p-3 text-left hover:scale-[1.02] transition-all"
                >
                  <Megaphone size={16} className="text-secondary mb-1.5" />
                  <p className="text-xs font-bold">{t("groups.announcementAction")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("groups.announcementActionDesc")}</p>
                </button>
                <button
                  onClick={() => navigate("createGame")}
                  className="card-elevated rounded-xl p-3 text-left hover:scale-[1.02] transition-all"
                >
                  <CalendarPlus size={16} className="text-primary mb-1.5" />
                  <p className="text-xs font-bold">{t("groups.scheduleGame")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("groups.scheduleGameDesc")}</p>
                </button>
                <button
                  onClick={() => setShowGroupInvite(true)}
                  className="card-elevated rounded-xl p-3 text-left hover:scale-[1.02] transition-all"
                >
                  <UserPlus size={16} className="text-[#BFFF00] mb-1.5" />
                  <p className="text-xs font-bold">Invite Players</p>
                  <p className="text-[10px] text-muted-foreground">Invite matches or nearby</p>
                </button>
                <button
                  onClick={() => setShowGroupInfo(true)}
                  className="card-elevated rounded-xl p-3 text-left hover:scale-[1.02] transition-all"
                >
                  <BarChart3 size={16} className="text-secondary mb-1.5" />
                  <p className="text-xs font-bold">{t("groups.groupInfo")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("groups.groupInfoDesc")}</p>
                </button>
              </div>
            </div>

            {/* Member Management */}
            <div className="card-elevated rounded-xl p-4">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Users size={13} className="text-primary" />
                </div>
                {t("groups.memberManagement")}
              </h3>
              <p className="text-[10px] text-muted-foreground mb-3">
                {isAdmin ? "Promote, demote, or remove members" : "Remove members as moderator"}
              </p>

              {membersQuery.isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin" size={20} /></div>
              ) : (
                <div className="space-y-1">
                  {members
                    .filter(m => m.userId !== user?.id)
                    .sort((a, b) => {
                      const order: Record<string, number> = { admin: 0, moderator: 1, member: 2 };
                      return (order[a.role] ?? 3) - (order[b.role] ?? 3);
                    })
                    .map((m: any) => {
                      const canActOn = isAdmin || (isMod && m.role === "member");
                      return (
                        <div key={m.userId} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/10 transition-colors">
                          <PlayerAvatar user={{ id: m.userId, profilePhotoUrl: m.profilePhotoUrl, hasProfilePhoto: m.hasProfilePhoto, name: m.name, nickname: m.nickname, gender: null }} size="sm" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium block truncate">{m.nickname || m.name || `User #${m.userId}`}</span>
                            <span className={cn("text-[10px] font-medium",
                              m.role === "admin" ? "text-primary" : m.role === "moderator" ? "text-secondary" : "text-muted-foreground"
                            )}>
                              {m.role === "admin" ? t("groups.admin") : m.role === "moderator" ? t("groups.moderator") : t("groups.member")}
                            </span>
                          </div>
                          {canActOn && (
                            <div className="flex gap-1">
                              {isAdmin && m.role === "member" && (
                                <button
                                  onClick={() => setConfirmAction({ type: "promote", userId: m.userId, name: m.nickname || m.name || "this member" })}
                                  className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                                  title="Promote to Moderator"
                                >
                                  <ShieldCheck size={13} className="text-primary" />
                                </button>
                              )}
                              {isAdmin && m.role === "moderator" && (
                                <button
                                  onClick={() => setConfirmAction({ type: "demote", userId: m.userId, name: m.nickname || m.name || "this member" })}
                                  className="p-1.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                                  title="Demote to Member"
                                >
                                  <Shield size={13} className="text-muted-foreground" />
                                </button>
                              )}
                              <button
                                onClick={() => setConfirmAction({ type: "kick", userId: m.userId, name: m.nickname || m.name || "this member" })}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                                title="Remove from Group"
                              >
                                <UserMinus size={13} className="text-red-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Group Info Summary */}
            <div className="card-elevated rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Settings size={14} className="text-muted-foreground" /> {t("groups.groupInfo")}
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{groupTypeIcons[group?.groupType]} {group?.groupType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visibility</span>
                  <span className="font-medium">{group?.isPrivate ? `🔒 ${t("groups.private")}` : `🌐 ${t("groups.public")}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("groups.members")}</span>
                  <span className="font-medium">{members.length}</span>
                </div>
                {group?.locationCity && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">City</span>
                    <span className="font-medium">📍 {group.locationCity}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{group?.createdAt ? new Date(group.createdAt).toLocaleDateString() : "—"}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <InvitePickerModal
        open={showGroupInvite}
        onClose={() => setShowGroupInvite(false)}
        targetType="group"
        targetId={selectedGroupId}
        targetName={group?.name}
      />
    </>
    );
  }

  return (
    <div className="pb-24 min-h-screen">
      <div className="px-5 pt-7 pb-3 flex items-center gap-3">
        <button onClick={() => goBack()} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">{t("groups.title")}</h1>
          <p className="text-[11px] text-muted-foreground">{groups.length} communities</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} size="sm" className="bg-gradient-to-r from-primary to-accent text-white gap-1.5 shadow-[0_0_16px_rgba(168,85,247,0.15)]">
          <Plus size={14} /> {t("groups.createGroup")}
        </Button>
      </div>

      {/* Create Group Form */}
      {showCreate && (
        <div className="px-5 pb-4 animate-slide-up">
          <div className="card-elevated rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold">{t("groups.createGroup")}</h3>
            {/* Group Photo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => newPhotoInputRef.current?.click()}
                className="relative w-16 h-16 rounded-xl bg-muted/20 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors"
              >
                {newPhoto ? (
                  <img src={newPhoto} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={20} className="text-muted-foreground/50" />
                )}
              </button>
              <div className="flex-1 text-xs text-muted-foreground">
                {newPhoto ? (
                  <button onClick={() => setNewPhoto("")} className="text-red-400 hover:text-red-300 text-xs">Remove photo</button>
                ) : (
                  "Add a group photo (optional)"
                )}
              </div>
              <input
                ref={newPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) { toast.error(t("common.fileTooLarge")); return; }
                  const formData = new FormData();
                  formData.append("file", file);
                  formData.append("purpose", "group");
                  try {
                    const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
                    if (!res.ok) throw new Error("Upload failed");
                    const data = await res.json();
                    setNewPhoto(data.url);
                    toast.success(t("common.photoUploaded"));
                  } catch { toast.error(t("common.uploadFailed")); }
                }}
              />
            </div>
            <Input placeholder="Group name" value={newName} onChange={e => setNewName(e.target.value)} className="bg-background/50" />
            <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="bg-background/50" />
            <Input placeholder="City (optional)" value={newCity} onChange={e => setNewCity(e.target.value)} className="bg-background/50" />
            <div className="flex gap-1.5 flex-wrap">
              {(["social", "league", "tournament", "coaching"] as const).map(gt => (
                <button key={gt} onClick={() => setNewType(gt)}
                  className={cn("text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all capitalize",
                    newType === gt ? "pill-tab-active text-white" : "bg-muted/15 text-muted-foreground hover:bg-muted/25"
                  )}
                >
                  {groupTypeIcons[gt]} {t(`groups.type${gt.charAt(0).toUpperCase() + gt.slice(1)}`)}
                </button>
              ))}
            </div>
            <button onClick={() => setNewPrivate(!newPrivate)}
              className={cn("text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all",
                newPrivate ? "pill-tab-active text-white" : "bg-muted/15 text-muted-foreground"
              )}
            >
              {newPrivate ? <Lock size={11} className="inline mr-1" /> : <Globe size={11} className="inline mr-1" />}
              {newPrivate ? t("groups.private") : t("groups.public")}
            </button>
            <Button
              onClick={() => createMutation.mutate({ name: newName, description: newDesc || undefined, groupType: newType, isPrivate: newPrivate, locationCity: newCity || undefined, photo: newPhoto || undefined })}
              disabled={!newName.trim() || createMutation.isPending}
              className="w-full bg-gradient-to-r from-primary to-accent text-white"
            >
              {createMutation.isPending ? "Creating..." : t("groups.createGroup")}
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-5 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <Input placeholder={t("groups.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-background/50" />
        </div>
      </div>

      {/* My Groups / All Groups Toggle */}
      <div className="px-5 pb-3 flex gap-2">
        <button onClick={() => setGroupView("mine")}
          className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all",
            groupView === "mine" ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
          )}
        >
          {t("groups.myGroups", "My Groups")}
        </button>
        <button onClick={() => setGroupView("all")}
          className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all",
            groupView === "all" ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
          )}
        >
          {t("groups.allGroups", "All Groups")}
        </button>
      </div>

      {/* Type Filters */}
      {groupView === "all" && (
      <div className="px-5 pb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
        {groupTypes.map(gt => (
          <button key={gt} onClick={() => setActiveType(gt)}
            className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
              activeType === gt ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
            )}
          >
            {t(`groups.type${gt}`)}
          </button>
        ))}
      </div>
      )}

      {/* Groups List */}
      <div className="px-5 space-y-2.5">
        {activeGroupsQuery.isError && !groups.length ? (
          <QueryError message="Failed to load groups" onRetry={() => { groupsQuery.refetch(); myGroupsQuery.refetch(); }} />
        ) : activeGroupsQuery.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 animate-slide-up">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/10 flex items-center justify-center mx-auto mb-3">
              <Users size={28} className="text-primary/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No groups found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Create one to get started!</p>
          </div>
        ) : (
          filtered.map((group: any, i: number) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className="w-full card-elevated rounded-xl p-4 text-left hover:scale-[1.01] transition-all active:scale-[0.99]"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center text-2xl flex-shrink-0">
                  {groupTypeIcons[group.groupType] ?? "👥"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm truncate">{group.name}</h3>
                    {group.isPrivate && <Lock size={10} className="text-muted-foreground/50 flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{group.description || "No description"}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="sport-badge sport-badge-purple text-[9px] py-0 capitalize">{group.groupType}</span>
                    {group.locationCity && <span className="text-[10px] text-muted-foreground">📍 {group.locationCity}</span>}
                    {group.memberCount != null && <span className="text-[10px] text-muted-foreground">{group.memberCount} {t("groups.members")}</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground/30 flex-shrink-0" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
