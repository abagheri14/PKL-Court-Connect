import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, GraduationCap, Plus, MapPin, Clock, Users, DollarSign, Calendar,
  Loader2, Star, MessageSquare, ChevronLeft, ChevronDown, Target, BookOpen,
  TrendingUp, Dumbbell, Brain, Edit3, X, Check, CheckCircle2, XCircle,
  ClipboardList, ListChecks, Wrench, Save, Award, Trash2, Send, Megaphone, Search, UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { QueryError } from "@/components/QueryError";
import PlayerAvatar from "@/components/PlayerAvatar";
import { useTranslation } from "react-i18next";
import LocationPickerSection, { type LocationData } from "@/components/LocationPickerSection";
import InvitePickerModal from "@/components/InvitePickerModal";

const statusFilters = ["All", "Open", "Full", "Completed"] as const;
const mainTabs = ["Explore", "My Sessions", "Drills", "Tips"] as const;
const detailTabs = ["Plan", "Participants", "Announcements", "Reviews"] as const;
const mySubTabs = ["Coaching", "Enrolled"] as const;

// Static drill library
const drillLibrary = [
  { id: 1, name: "Dink Rally Warm-Up", category: "Dinking", level: "Beginner", duration: "10 min", icon: "🏓", desc: "Practice soft dinking rallies from the kitchen line. Focus on control over power." },
  { id: 2, name: "Third Shot Drop", category: "Transition", level: "Intermediate", duration: "15 min", icon: "🎯", desc: "Practice the third shot drop from the baseline to move into the kitchen." },
  { id: 3, name: "Speed-Up Reaction", category: "Speed-Up", level: "Advanced", duration: "10 min", icon: "⚡", desc: "Partner alternates between dinks and speed-ups. React and counter." },
  { id: 4, name: "Serve & Return Deep", category: "Serving", level: "Beginner", duration: "10 min", icon: "🚀", desc: "Practice deep serves and deep returns. Aim for the back 3 feet of the court." },
  { id: 5, name: "Erne Approach", category: "Advanced Shots", level: "Advanced", duration: "15 min", icon: "🦅", desc: "Practice the erne — jumping around the post to volley. Timing is key." },
  { id: 6, name: "Reset Drill", category: "Defense", level: "Intermediate", duration: "12 min", icon: "🛡️", desc: "One player attacks, the other resets. Focus on keeping the ball low and soft." },
  { id: 7, name: "Crosscourt Dinks", category: "Dinking", level: "Beginner", duration: "10 min", icon: "↗️", desc: "Practice crosscourt dinking patterns. Keep low over the net with consistent placement." },
  { id: 8, name: "Lob Defense", category: "Defense", level: "Intermediate", duration: "10 min", icon: "🌙", desc: "Partner lobs, you track and hit an overhead or transition back. Footwork focus." },
  { id: 9, name: "Stacking Practice", category: "Strategy", level: "Advanced", duration: "20 min", icon: "🧠", desc: "Practice stacking formations with a partner. Switch sides efficiently after serve/return." },
  { id: 10, name: "Drop Volley Touch", category: "Transition", level: "Intermediate", duration: "12 min", icon: "✨", desc: "Practice soft drop volleys from mid-court. Goal: ball bounces in the kitchen." },
];

const tipOfTheDay = [
  { title: "Master the Kitchen Line", tip: "The team that controls the kitchen line wins 80% of rallies. Always move forward after the third shot.", icon: "🏠" },
  { title: "Patience Wins Points", tip: "Don't speed up until you have a ball above the net. Dink until you get the right opportunity.", icon: "⏳" },
  { title: "Watch the Paddle", tip: "Read your opponent's paddle face to anticipate where they'll hit. A tilted paddle means a cross-court shot.", icon: "👀" },
  { title: "Ready Position", tip: "Keep your paddle up at chest height between shots. A low paddle costs you reaction time.", icon: "🏓" },
  { title: "Serve Deep", tip: "A deep serve pushes your opponent back and gives you time to move forward. Aim for the last 3 feet.", icon: "🎯" },
  { title: "Two-Bounce Rule", tip: "Remember: the serve and return must both bounce. Use this to your advantage — push deep returns.", icon: "📏" },
  { title: "Communicate!", tip: "In doubles, call 'mine' or 'yours' early. Middle balls cause more errors than any shot.", icon: "🗣️" },
];

export default function CoachingScreen() {
  const { user, goBack } = useApp();
  const { t, i18n } = useTranslation();
  const [activeFilter, setActiveFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [mainTab, setMainTab] = useState<typeof mainTabs[number]>("Explore");
  const [mySubTab, setMySubTab] = useState<typeof mySubTabs[number]>("Coaching");
  const [drillFilter, setDrillFilter] = useState("All");
  const [sessionSearch, setSessionSearch] = useState("");

  // Create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coachName, setCoachName] = useState("");
  const [location, setLocation] = useState("");
  const [isVirtual, setIsVirtual] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [cost, setCost] = useState("");
  const [skillLevel, setSkillLevel] = useState("");

  // Session detail
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<typeof detailTabs[number]>("Plan");
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Plan editing
  const [editingPlan, setEditingPlan] = useState(false);
  const [planAgenda, setPlanAgenda] = useState("");
  const [planFocus, setPlanFocus] = useState("");
  const [planDrills, setPlanDrills] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [planEquipment, setPlanEquipment] = useState("");

  // Dismissed cancelled sessions (swipe to remove)
  const [dismissedSessions, setDismissedSessions] = useState<Set<number>>(new Set());
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const [showCoachingInvite, setShowCoachingInvite] = useState(false);
  const [locationData, setLocationData] = useState<LocationData>({});

  const statusFilter = activeFilter === "All" ? undefined : activeFilter.toLowerCase() as "open" | "full" | "completed" | "cancelled";
  const sessionsQuery = trpc.coaching.list.useQuery({ status: statusFilter }, { refetchInterval: 30000 });
  const allSessions: any[] = sessionsQuery.data ?? [];
  const sessions = sessionSearch.trim()
    ? allSessions.filter((s: any) => {
        const q = sessionSearch.toLowerCase();
        return (s.title?.toLowerCase().includes(q) ||
                s.description?.toLowerCase().includes(q) ||
                s.coachName?.toLowerCase().includes(q) ||
                s.location?.toLowerCase().includes(q));
      })
    : allSessions;

  const mySessionsQuery = trpc.coaching.getMySessions.useQuery(undefined, { enabled: mainTab === "My Sessions", refetchInterval: 30000 });
  const myCoaching: any[] = mySessionsQuery.data?.coaching ?? [];
  const myEnrolled: any[] = mySessionsQuery.data?.enrolled ?? [];

  // Reset selection if session no longer exists in data (only after queries have loaded)
  useEffect(() => {
    if (selectedSessionId && !sessionsQuery.isLoading && !mySessionsQuery.isLoading) {
      const allSessions = [...sessions, ...myCoaching, ...myEnrolled];
      if (allSessions.length > 0 && !allSessions.some(s => s.id === selectedSessionId)) {
        setSelectedSessionId(null);
      }
    }
  }, [selectedSessionId, sessions, myCoaching, myEnrolled, sessionsQuery.isLoading, mySessionsQuery.isLoading]);

  const createMutation = trpc.coaching.create.useMutation({
    onSuccess: () => {
      toast.success(t("coaching.sessionCreated"));
      sessionsQuery.refetch();
      mySessionsQuery.refetch();
      setShowCreate(false);
      setTitle(""); setDescription(""); setCoachName(""); setLocation(""); setScheduledAt(""); setCost(""); setIsVirtual(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const joinMutation = trpc.coaching.join.useMutation({
    onSuccess: () => {
      toast.success(t("coaching.requestSentApproval"));
      sessionsQuery.refetch();
      mySessionsQuery.refetch();
      if (selectedSessionId) participantsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveMutation = trpc.coaching.approveParticipant.useMutation({
    onSuccess: () => {
      toast.success(t("coaching.participantApproved"));
      if (selectedSessionId) participantsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const declineMutation = trpc.coaching.declineParticipant.useMutation({
    onSuccess: () => {
      toast(t("coaching.participantDeclined"));
      if (selectedSessionId) participantsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const leaveMutation = trpc.coaching.leave.useMutation({
    onSuccess: () => {
      toast(t("coaching.leftSession"));
      sessionsQuery.refetch();
      mySessionsQuery.refetch();
      if (selectedSessionId) participantsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelMutation = trpc.coaching.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("coaching.sessionCancelled"));
      sessionsQuery.refetch();
      mySessionsQuery.refetch();
      setSelectedSessionId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const completeMutation = trpc.coaching.complete.useMutation({
    onSuccess: () => {
      toast.success(t("coaching.sessionCompleted"));
      sessionsQuery.refetch();
      mySessionsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = trpc.coaching.update.useMutation({
    onSuccess: () => {
      toast.success(t("coaching.planSaved"));
      sessionsQuery.refetch();
      mySessionsQuery.refetch();
      setEditingPlan(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const attendanceMutation = trpc.coaching.markAttendance.useMutation({
    onSuccess: () => {
      participantsQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const participantsQuery = trpc.coaching.getParticipants.useQuery(
    { coachingId: selectedSessionId! },
    { enabled: !!selectedSessionId, refetchInterval: 30000 }
  );
  const participants: any[] = participantsQuery.data ?? [];

  const reviewsQuery = trpc.coaching.getReviews.useQuery(
    { coachingId: selectedSessionId! },
    { enabled: !!selectedSessionId, refetchInterval: 30000 }
  );
  const reviews: any[] = reviewsQuery.data ?? [];

  const addReviewMutation = trpc.coaching.addReview.useMutation({
    onSuccess: () => {
      toast.success(t("coaching.reviewSubmitted"));
      reviewsQuery.refetch();
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const announcementsQuery = trpc.coaching.getAnnouncements.useQuery(
    { coachingId: selectedSessionId! },
    { enabled: !!selectedSessionId, refetchInterval: 30000 }
  );
  const announcements: any[] = announcementsQuery.data ?? [];
  const [announcementText, setAnnouncementText] = useState("");
  const postAnnouncementMutation = trpc.coaching.postAnnouncement.useMutation({
    onSuccess: () => {
      toast.success(t("coaching.announcementPosted"));
      announcementsQuery.refetch();
      setAnnouncementText("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!title.trim() || !scheduledAt) {
      toast.error(t("coaching.titleDateRequired"));
      return;
    }
    createMutation.mutate({
      title,
      description: description || undefined,
      coachName: coachName || undefined,
      location: isVirtual ? "Virtual" : (locationData.locationName || location || undefined),
      courtId: isVirtual ? undefined : (locationData.courtId || undefined),
      locationLat: isVirtual ? undefined : (locationData.locationLat || undefined),
      locationLng: isVirtual ? undefined : (locationData.locationLng || undefined),
      locationName: isVirtual ? undefined : (locationData.locationName || location || undefined),
      isVirtual,
      scheduledAt,
      durationMinutes: duration,
      maxParticipants,
      costPerPerson: cost ? parseFloat(cost) : undefined,
      skillLevel: skillLevel || undefined,
    });
  };

  // Daily tip (rotates daily)
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const todayTip = tipOfTheDay[dayIndex % tipOfTheDay.length];

  // Drill filtering
  const drillCategories = ["All", ...Array.from(new Set(drillLibrary.map(d => d.category)))];
  const filteredDrills = drillFilter === "All" ? drillLibrary : drillLibrary.filter(d => d.category === drillFilter);

  // ═══════════════════════════════════════════════════════════════════════
  // SESSION DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (selectedSessionId) {
    const allSessions = [...sessions, ...myCoaching, ...myEnrolled];
    const seen = new Set<number>();
    const uniqueSessions = allSessions.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
    const session = uniqueSessions.find((s: any) => s.id === selectedSessionId);
    if (!session) return null;
    const isOrganizer = session.organizerId === user?.id;
    const isPast = new Date(session.scheduledAt) < new Date();
    const isJoined = participants.some((p: any) => p.userId === user?.id && p.status === "confirmed");
    const isPendingApproval = participants.some((p: any) => p.userId === user?.id && p.status === "pending");
    const avgRating = reviews.length > 0 ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1) : null;
    const confirmedParticipants = participants.filter((p: any) => p.status === "confirmed" && p.userId !== session.organizerId);

    const startEditPlan = () => {
      setPlanAgenda(session.agenda || "");
      setPlanFocus(session.focusAreas || "");
      setPlanDrills(session.drillPlan || "");
      setPlanNotes(session.sessionNotes || "");
      setPlanEquipment(session.equipmentNeeded || "");
      setEditingPlan(true);
    };

    const savePlan = () => {
      updateMutation.mutate({
        coachingId: session.id,
        agenda: planAgenda || undefined,
        focusAreas: planFocus || undefined,
        drillPlan: planDrills || undefined,
        sessionNotes: planNotes || undefined,
        equipmentNeeded: planEquipment || undefined,
      });
    };

    return (
      <div className="pb-24 min-h-screen">
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-secondary/8 blur-3xl" />
          <div className="relative px-5 pt-7 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => { if (showSessionInfo) { setShowSessionInfo(false); } else { setSelectedSessionId(null); setDetailTab("Plan"); setEditingPlan(false); } }} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setShowSessionInfo(!showSessionInfo)} className="flex-1 min-w-0 text-left">
                <h1 className="text-lg font-bold truncate">{session.title}</h1>
                <div className="flex items-center gap-2">
                  {session.coachName && <p className="text-xs text-secondary font-semibold">{t("coaching.coach", { name: session.coachName })}</p>}
                  <span className={cn("sport-badge text-[9px] py-0 capitalize",
                    session.status === "open" ? "sport-badge-green" : session.status === "full" ? "sport-badge-gold" : session.status === "cancelled" ? "sport-badge-red" : ""
                  )}>{session.status}</span>
                </div>
              </button>
              <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", showSessionInfo && "rotate-180")} />
              {avgRating && (
                <div className="flex items-center gap-1 sport-badge sport-badge-gold text-[11px] py-0.5">
                  <Star size={11} className="fill-secondary" /> {avgRating}
                </div>
              )}
            </div>

            {/* Detail Tabs */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {detailTabs.map(tab => {
                const TabIcon = tab === "Plan" ? ClipboardList : tab === "Participants" ? Users : tab === "Announcements" ? Megaphone : tab === "Reviews" ? Star : Star;
                return (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                      detailTab === tab ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    <TabIcon size={13} />
                    {t(`coaching.tab${tab}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-5 space-y-4 animate-slide-up">
          {/* ─── SESSION INFO DROPDOWN (tap header to toggle) ─── */}
          {showSessionInfo && (
            <div className="card-hero rounded-xl p-4 animate-slide-up">
              <div className="relative z-10">
                {session.description && <p className="text-sm text-muted-foreground leading-relaxed mb-3">{session.description}</p>}
                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  {[
                    { icon: Calendar, label: `${new Date(session.scheduledAt).toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" })} ${new Date(session.scheduledAt).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}`, color: "text-secondary" },
                    { icon: Clock, label: `${session.durationMinutes} ${t("coaching.minutes")}`, color: "text-primary" },
                    { icon: MapPin, label: session.location || "TBD", color: "text-secondary" },
                    { icon: DollarSign, label: session.costPerPerson > 0 ? `$${session.costPerPerson}` : t("coaching.free"), color: "text-secondary" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <item.icon size={13} className={item.color} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {session.skillLevel && <span className="sport-badge sport-badge-purple text-[10px]">{session.skillLevel}</span>}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users size={12} /> {t("coaching.spots", { current: confirmedParticipants.length, max: session.maxParticipants })}
                  </span>
                </div>

                {session.focusAreas && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-secondary uppercase tracking-wide mb-1">{t("coaching.focusAreas")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {session.focusAreas.split(",").map((area: string, i: number) => (
                        <span key={i} className="sport-badge sport-badge-cyan text-[9px] py-0.5">{area.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}
                {session.equipmentNeeded && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3">
                    <Wrench size={12} className="text-secondary mt-0.5 flex-shrink-0" />
                    <span>{session.equipmentNeeded}</span>
                  </div>
                )}

                {/* Participant preview */}
                {confirmedParticipants.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Participants ({confirmedParticipants.length}/{session.maxParticipants})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {confirmedParticipants.slice(0, 6).map((p: any) => (
                        <div key={p.userId} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/10">
                          <PlayerAvatar user={{ id: p.userId, profilePhotoUrl: p.profilePhotoUrl, hasProfilePhoto: !!p.profilePhotoUrl, name: p.name, nickname: p.nickname, gender: null }} size="sm" />
                          <span className="text-[9px] font-medium">{p.nickname || p.name || "User"}</span>
                        </div>
                      ))}
                      {confirmedParticipants.length > 6 && (
                        <button onClick={() => { setDetailTab("Participants"); setShowSessionInfo(false); }} className="px-2 py-1 rounded-lg bg-muted/10 text-[10px] text-muted-foreground">+{confirmedParticipants.length - 6} more</button>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  {!isOrganizer && session.status === "open" && !isJoined && !isPendingApproval && (
                    <Button onClick={() => joinMutation.mutate({ coachingId: session.id })} size="sm" className="bg-gradient-to-r from-primary to-accent text-white text-xs shadow-[0_0_16px_rgba(168,85,247,0.2)]" disabled={joinMutation.isPending}>
                      {joinMutation.isPending ? t("coaching.requesting") : t("coaching.requestToJoin")}
                    </Button>
                  )}
                  {isPendingApproval && (
                    <span className="text-xs text-amber-400 font-semibold px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
                      ⏳ {t("coaching.pendingApproval")}
                    </span>
                  )}
                  {isJoined && !isPast && !isOrganizer && (
                    <Button onClick={() => leaveMutation.mutate({ coachingId: session.id })} variant="outline" size="sm" className="text-xs border-red-400/30 text-red-400 hover:bg-red-500/10">
                      {t("coaching.leave")}
                    </Button>
                  )}
                  {isOrganizer && session.status === "open" && (
                    <>
                      <Button onClick={() => setShowCoachingInvite(true)} variant="outline" size="sm" className="text-xs gap-1.5 border-[#BFFF00]/30 text-[#BFFF00] hover:bg-[#BFFF00]/10">
                        <UserPlus size={13} /> Invite Players
                      </Button>
                      <Button onClick={() => completeMutation.mutate({ coachingId: session.id })} size="sm" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs gap-1.5" disabled={completeMutation.isPending}>
                        <CheckCircle2 size={13} /> {t("coaching.markComplete")}
                      </Button>
                      <Button onClick={() => cancelMutation.mutate({ coachingId: session.id })} variant="outline" size="sm" className="text-xs border-red-400/30 text-red-400 hover:bg-red-500/10 gap-1.5" disabled={cancelMutation.isPending}>
                        <XCircle size={13} /> {t("coaching.cancelSession")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── PLAN TAB ─── */}
          {detailTab === "Plan" && (
            <>
              {isOrganizer && !editingPlan && (
                <Button onClick={startEditPlan} size="sm" className="bg-gradient-to-r from-primary to-accent text-white text-xs gap-1.5 w-full">
                  <Edit3 size={13} /> {session.agenda ? t("coaching.editSessionPlan") : t("coaching.createSessionPlan")}
                </Button>
              )}

              {editingPlan && isOrganizer ? (
                <div className="space-y-4">
                  <div className="card-elevated rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <ClipboardList size={14} className="text-secondary" /> {t("coaching.sessionPlanEditor")}
                    </h3>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{t("coaching.sessionAgenda")}</label>
                      <textarea value={planAgenda} onChange={e => setPlanAgenda(e.target.value)}
                        placeholder={"e.g.\n1. Warm-up dinking (10 min)\n2. Third shot drop practice (15 min)\n3. Live point play (20 min)\n4. Cool down & debrief (5 min)"}
                        className="w-full bg-background/50 border border-border/30 rounded-lg px-3 py-2 text-sm min-h-[100px] resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{t("coaching.focusAreasLabel")}</label>
                      <Input value={planFocus} onChange={e => setPlanFocus(e.target.value)}
                        placeholder="e.g. Dinking, Third Shot Drop, Kitchen Control"
                        className="bg-background/50"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">{t("coaching.drillPlan")}</label>
                      <textarea value={planDrills} onChange={e => setPlanDrills(e.target.value)}
                        placeholder={"e.g.\nDrill 1: Dink Rally Warm-Up - 10 min\nDrill 2: Third Shot Drop from baseline - 15 min\nDrill 3: Cross-court dinking patterns - 10 min"}
                        className="w-full bg-background/50 border border-border/30 rounded-lg px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      {/* Quick add from drill library */}
                      <p className="text-[10px] text-muted-foreground mt-1.5 mb-1">{t("coaching.quickAddFromLibrary")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {drillLibrary.slice(0, 6).map(drill => (
                          <button key={drill.id} onClick={() => setPlanDrills(prev => prev ? `${prev}\n${drill.name} - ${drill.duration}` : `${drill.name} - ${drill.duration}`)}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-muted/15 text-muted-foreground hover:bg-muted/25 transition-colors flex items-center gap-1"
                          >
                            {drill.icon} {drill.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{t("coaching.equipmentLabel")}</label>
                      <Input value={planEquipment} onChange={e => setPlanEquipment(e.target.value)}
                        placeholder="e.g. Paddles, training balls, cones, net"
                        className="bg-background/50"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{t("coaching.coachNotes")}</label>
                      <textarea value={planNotes} onChange={e => setPlanNotes(e.target.value)}
                        placeholder="e.g. Remember to focus on footwork for the beginners in this group. Check who needs help with backhand."
                        className="w-full bg-background/50 border border-border/30 rounded-lg px-3 py-2 text-sm min-h-[70px] resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={savePlan} disabled={updateMutation.isPending} className="flex-1 bg-gradient-to-r from-primary to-accent text-white gap-1.5">
                        <Save size={14} /> {updateMutation.isPending ? t("coaching.creating") : t("coaching.savePlan")}
                      </Button>
                      <Button onClick={() => setEditingPlan(false)} variant="outline" className="gap-1.5">
                        <X size={14} /> Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Read-only plan view */
                <div className="space-y-3">
                  {!session.agenda && !session.focusAreas && !session.drillPlan && !session.equipmentNeeded ? (
                    <div className="card-elevated rounded-xl p-6 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/15 to-orange-500/10 flex items-center justify-center mx-auto mb-3">
                        <ClipboardList size={24} className="text-secondary/50" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">{t("coaching.noSessionPlanYet")}</p>
                      <p className="text-[11px] text-muted-foreground/60">
                        {isOrganizer ? t("coaching.noSessionPlanCoachDesc") : t("coaching.noSessionPlanUserDesc")}
                      </p>
                    </div>
                  ) : (
                    <>
                      {session.agenda && (
                        <div className="card-elevated rounded-xl p-4">
                          <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                              <ClipboardList size={13} className="text-primary" />
                            </div>
                            {t("coaching.sessionAgenda")}
                          </h3>
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">{session.agenda}</pre>
                        </div>
                      )}

                      {session.focusAreas && (
                        <div className="card-elevated rounded-xl p-4">
                          <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                              <Target size={13} className="text-primary" />
                            </div>
                            {t("coaching.focusAreas")}
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {session.focusAreas.split(",").map((area: string, i: number) => (
                              <span key={i} className="sport-badge sport-badge-purple text-[10px]">{area.trim()}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {session.drillPlan && (
                        <div className="card-neon rounded-xl p-4">
                          <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center">
                              <Dumbbell size={13} className="text-secondary" />
                            </div>
                            {t("coaching.drillPlan")}
                          </h3>
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">{session.drillPlan}</pre>
                        </div>
                      )}

                      {session.equipmentNeeded && (
                        <div className="card-elevated rounded-xl p-4">
                          <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center">
                              <Wrench size={13} className="text-secondary" />
                            </div>
                            {t("coaching.equipmentNeeded")}
                          </h3>
                          <p className="text-xs text-muted-foreground">{session.equipmentNeeded}</p>
                        </div>
                      )}

                      {isOrganizer && session.sessionNotes && (
                        <div className="card-gold rounded-xl p-4">
                          <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-secondary/20 to-orange-500/10 flex items-center justify-center">
                              <Brain size={13} className="text-secondary" />
                            </div>
                            {t("coaching.coachNotes")} <span className="text-[9px] text-muted-foreground font-normal">(only you)</span>
                          </h3>
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">{session.sessionNotes}</pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ─── PARTICIPANTS TAB ─── */}
          {detailTab === "Participants" && (
            <div className="card-elevated rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Users size={13} className="text-primary" />
                </div>
                Participants ({confirmedParticipants.length}/{session.maxParticipants})
              </h3>
              {isOrganizer && session.status !== "cancelled" && (
                <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1.5">
                  <ListChecks size={11} className="text-secondary" />
                  {participants.some((p: any) => p.status === "pending") ? t("coaching.approveDecline") : t("coaching.trackAttendance")}
                </p>
              )}
              {participantsQuery.isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin" size={20} /></div>
              ) : (
                <div className="space-y-1.5">
                  {participants.map((p: any) => {
                    const isConfirmed = p.status === "confirmed";
                    const isPending = p.status === "pending";
                    return (
                      <div key={p.userId} className={cn("flex items-center gap-2.5 p-2 rounded-lg transition-colors", isConfirmed ? "hover:bg-muted/10" : isPending ? "bg-amber-400/5 border border-amber-400/15" : "opacity-50")}>
                        <PlayerAvatar user={{ id: p.userId, profilePhotoUrl: p.profilePhotoUrl, hasProfilePhoto: !!p.profilePhotoUrl, name: p.name, nickname: p.nickname, gender: null }} size="sm" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{p.nickname || p.name || `User #${p.userId}`}</span>
                          <span className={cn("text-[9px] capitalize", isConfirmed ? "text-green-400" : isPending ? "text-amber-400" : "text-red-400")}>{p.status}</span>
                        </div>
                        {p.attended && <span className="sport-badge sport-badge-green text-[9px] py-0">{t("coaching.attended")}</span>}
                        {isOrganizer && isPending && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => approveMutation.mutate({ coachingId: session.id, userId: p.userId })}
                              className="px-2.5 py-1 rounded-lg bg-green-500/20 text-green-400 text-[10px] font-bold hover:bg-green-500/30 transition-colors"
                            >
                              {t("coaching.approve")}
                            </button>
                            <button
                              onClick={() => declineMutation.mutate({ coachingId: session.id, userId: p.userId })}
                              className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30 transition-colors"
                            >
                              {t("coaching.decline")}
                            </button>
                          </div>
                        )}
                        {isOrganizer && isConfirmed && (
                          <button
                            onClick={() => attendanceMutation.mutate({ coachingId: session.id, userId: p.userId, attended: !p.attended })}
                            className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                              p.attended ? "bg-green-500/20 text-green-400" : "bg-muted/10 text-muted-foreground/30 hover:bg-muted/20"
                            )}
                          >
                            <Check size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {participants.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">{t("coaching.noParticipants")}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── ANNOUNCEMENTS TAB ─── */}
          {detailTab === "Announcements" && (
            <div className="card-elevated rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Megaphone size={13} className="text-primary" />
                </div>
                {t("coaching.announcements")}
              </h3>
              {isOrganizer && (
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder={t("coaching.announcementPlaceholder")}
                    value={announcementText}
                    onChange={e => setAnnouncementText(e.target.value)}
                    className="bg-background/50 text-sm flex-1"
                    onKeyDown={e => { if (e.key === "Enter" && announcementText.trim()) postAnnouncementMutation.mutate({ coachingId: session.id, content: announcementText.trim() }); }}
                  />
                  <Button
                    onClick={() => { if (announcementText.trim()) postAnnouncementMutation.mutate({ coachingId: session.id, content: announcementText.trim() }); }}
                    size="sm"
                    disabled={!announcementText.trim() || postAnnouncementMutation.isPending}
                    className="bg-primary text-white px-3"
                  >
                    <Send size={14} />
                  </Button>
                </div>
              )}
              {announcements.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("coaching.noAnnouncements")}</p>
              ) : (
                <div className="space-y-3">
                  {announcements.map((a: any) => (
                    <div key={a.id} className="border-b border-border/20 pb-2.5 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">{a.senderNickname || a.senderName || "Coach"}</span>
                        <span className="text-[9px] text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── REVIEWS TAB ─── */}
          {detailTab === "Reviews" && (
            <div className="card-elevated rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center">
                  <Star size={13} className="text-secondary" />
                </div>
                {t("coaching.reviews", { count: reviews.length })}
                {avgRating && <span className="text-xs text-secondary font-normal ml-1">{t("coaching.avgRating", { rating: avgRating })}</span>}
              </h3>
              {reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("coaching.noReviews")}</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r: any) => (
                    <div key={r.id} className="border-b border-border/20 pb-2.5 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">{r.userNickname || r.userName || "User"}</span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} size={10} className={n <= r.rating ? "text-secondary fill-secondary" : "text-muted-foreground/20"} />
                          ))}
                        </div>
                      </div>
                      {r.comment && <p className="text-xs text-muted-foreground leading-relaxed">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
              {(isPast || session.status === "completed") && isJoined && !showReviewForm && (
                <Button onClick={() => setShowReviewForm(true)} variant="outline" size="sm" className="mt-3 text-xs w-full gap-1.5">
                  <MessageSquare size={12} /> {t("coaching.writeReview")}
                </Button>
              )}
              {showReviewForm && (
                <div className="mt-3 space-y-2.5 border-t border-border/20 pt-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{t("coaching.yourRating")}</p>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setReviewRating(n)} className="transition-transform hover:scale-110">
                        <Star size={22} className={n <= reviewRating ? "text-secondary fill-secondary" : "text-muted-foreground/20"} />
                      </button>
                    ))}
                  </div>
                  <Input placeholder={t("coaching.reviewPlaceholder")} value={reviewComment} onChange={e => setReviewComment(e.target.value)} className="bg-background/50 text-sm" />
                  <div className="flex gap-2">
                    <Button onClick={() => { if (!reviewRating) { toast.error(t("coaching.pleaseSelectRating")); return; } addReviewMutation.mutate({ coachingId: session.id, rating: reviewRating, comment: reviewComment || undefined }); }} size="sm" className="bg-gradient-to-r from-primary to-accent text-white text-xs" disabled={addReviewMutation.isPending}>
                      {t("coaching.submit")}
                    </Button>
                    <Button onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewComment(""); }} variant="outline" size="sm" className="text-xs">Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <InvitePickerModal
          open={showCoachingInvite}
          onClose={() => setShowCoachingInvite(false)}
          targetType="coaching"
          targetId={selectedSessionId}
          targetName={session?.title}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN VIEW
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="pb-24 min-h-screen">
      <div className="relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-secondary/8 blur-3xl" />
        <div className="relative px-5 pt-7 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => goBack()} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold tracking-tight">{t("coaching.title")}</h1>
              <p className="text-[11px] text-muted-foreground">{t("coaching.subtitle")}</p>
            </div>
            {(mainTab === "Explore" || mainTab === "My Sessions") && (
              <Button onClick={() => setShowCreate(!showCreate)} size="sm" className="bg-gradient-to-r from-primary to-accent text-white gap-1.5 shadow-[0_0_16px_rgba(168,85,247,0.15)]">
                <Plus size={14} /> {t("coaching.host")}
              </Button>
            )}
          </div>

          {/* Main Tabs */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {mainTabs.map(tab => {
              const TabIcon = tab === "Explore" ? GraduationCap : tab === "My Sessions" ? Award : tab === "Drills" ? Dumbbell : BookOpen;
              return (
                <button key={tab} onClick={() => setMainTab(tab)}
                  className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                    mainTab === tab ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
                  )}
                >
                  <TabIcon size={13} />
                  {t(`coaching.tab${tab.replace(/\s+/g, "")}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ TIP OF THE DAY ═══ */}
      {mainTab === "Explore" && (
        <div className="px-5 mb-4 animate-slide-up">
          <div className="card-gold rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/20 to-orange-500/10 flex items-center justify-center text-lg flex-shrink-0">
              {todayTip.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-wide mb-0.5">{t("coaching.tipOfTheDay")}</p>
              <p className="text-xs font-semibold">{todayTip.title}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{todayTip.tip}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE SESSION FORM ═══ */}
      {showCreate && (mainTab === "Explore" || mainTab === "My Sessions") && (
        <div className="px-5 pb-4 animate-slide-up">
          <div className="card-elevated rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <GraduationCap size={14} className="text-secondary" /> {t("coaching.hostCoachingSession")}
            </h3>
            <Input placeholder={t("coaching.sessionTitlePlaceholder")} value={title} onChange={e => setTitle(e.target.value)} className="bg-background/50" />
            <Input placeholder={t("coaching.descriptionPlaceholder")} value={description} onChange={e => setDescription(e.target.value)} className="bg-background/50" />
            <Input placeholder={t("coaching.coachNamePlaceholder")} value={coachName} onChange={e => setCoachName(e.target.value)} className="bg-background/50" />
            <div className="flex items-center gap-3">
              <button onClick={() => setIsVirtual(false)}
                className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all text-center",
                  !isVirtual ? "pill-tab-active text-white" : "bg-muted/15 text-muted-foreground"
                )}
              >
                {t("coaching.inPerson")}
              </button>
              <button onClick={() => setIsVirtual(true)}
                className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all text-center",
                  isVirtual ? "pill-tab-active text-white" : "bg-muted/15 text-muted-foreground"
                )}
              >
                {t("coaching.virtual")}
              </button>
            </div>
            {!isVirtual && (
              <LocationPickerSection
                value={locationData}
                onChange={setLocationData}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">{t("coaching.dateTime")}</label>
                <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="bg-background/50 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">{t("coaching.durationMin")}</label>
                <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="bg-background/50 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">{t("coaching.maxParticipants")}</label>
                <Input type="number" value={maxParticipants} onChange={e => setMaxParticipants(Number(e.target.value))} className="bg-background/50 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">{t("coaching.costLabel")}</label>
                <Input type="number" step="0.01" placeholder={t("coaching.costPlaceholder")} value={cost} onChange={e => setCost(e.target.value)} className="bg-background/50 text-xs" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">{t("coaching.skillLevelLabel")}</label>
              <div className="flex gap-1.5 flex-wrap">
                {["All Levels", "Beginner", "Intermediate", "Advanced"].map(level => (
                  <button key={level} onClick={() => setSkillLevel(skillLevel === level ? "" : level)}
                    className={cn("text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all",
                      skillLevel === level ? "pill-tab-active text-white" : "bg-muted/15 text-muted-foreground"
                    )}
                  >
                    {t(`coaching.${level === "All Levels" ? "allLevels" : level.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full bg-gradient-to-r from-primary to-accent text-white">
              {createMutation.isPending ? t("coaching.creating") : t("coaching.createSession")}
            </Button>
          </div>
        </div>
      )}

      {/* ═══ EXPLORE TAB ═══ */}
      {mainTab === "Explore" && (
        <>
          <div className="px-5 pb-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                value={sessionSearch}
                onChange={e => setSessionSearch(e.target.value)}
                placeholder={t("coaching.searchSessions", "Search sessions...")}
                className="pl-9 h-9 text-sm rounded-xl bg-muted/10 border-muted/20 focus:border-primary/40"
              />
              {sessionSearch && (
                <button onClick={() => setSessionSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="px-5 pb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
            {statusFilters.map(f => (
              <button key={f} onClick={() => setActiveFilter(f)}
                className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                  activeFilter === f ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
                )}
              >
                {t(`coaching.filter${f}`)}
              </button>
            ))}
          </div>

          <div className="px-5 space-y-2.5">
            {sessionsQuery.isError && !sessions.length ? (
              <QueryError message={t("coaching.failedLoadSessions")} onRetry={() => sessionsQuery.refetch()} />
            ) : sessionsQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 animate-slide-up">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary/15 to-orange-500/10 flex items-center justify-center mx-auto mb-3">
                  <GraduationCap size={28} className="text-secondary/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{t("coaching.noSessionsFound")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t("coaching.noSessionsFoundDesc")}</p>
              </div>
            ) : (
              sessions.map((session: any) => <SessionCard key={session.id} session={session} onSelect={setSelectedSessionId} />)
            )}
          </div>
        </>
      )}

      {/* ═══ MY SESSIONS TAB ═══ */}
      {mainTab === "My Sessions" && (
        <div className="animate-slide-up">
          {/* Coach Dashboard Stats */}
          <div className="px-5 mb-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: GraduationCap, label: t("coaching.coachingCount"), value: myCoaching.length, color: "text-secondary", bg: "from-secondary/15 to-secondary/5" },
                { icon: BookOpen, label: t("coaching.enrolledCount"), value: myEnrolled.length, color: "text-primary", bg: "from-primary/15 to-primary/5" },
                { icon: Users, label: t("coaching.totalStudents"), value: myCoaching.reduce((sum: number, s: any) => sum + ((s as any).participantCount ?? 0), 0), color: "text-primary", bg: "from-primary/15 to-primary/5" },
              ].map(stat => (
                <div key={stat.label} className="card-elevated rounded-xl p-3 text-center">
                  <div className={`w-8 h-8 rounded-lg mx-auto mb-1 flex items-center justify-center bg-gradient-to-br ${stat.bg}`}>
                    <stat.icon size={15} className={stat.color} />
                  </div>
                  <p className="text-base font-bold stat-number">{stat.value}</p>
                  <p className="text-[9px] text-muted-foreground font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sub tabs */}
          <div className="px-5 pb-3 flex gap-1.5">
            {mySubTabs.map(tab => (
              <button key={tab} onClick={() => setMySubTab(tab)}
                className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all text-center",
                  mySubTab === tab ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
                )}
              >
                {tab === "Coaching" ? `${t("coaching.coachingCount")} (${myCoaching.length})` : `${t("coaching.enrolledCount")} (${myEnrolled.length})`}
              </button>
            ))}
          </div>

          <div className="px-5 space-y-2.5">
            {mySessionsQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
            ) : (
              <>
                {mySubTab === "Coaching" && (
                  myCoaching.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/15 to-orange-500/10 flex items-center justify-center mx-auto mb-3">
                        <GraduationCap size={24} className="text-secondary/50" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">{t("coaching.noSessionsCreated")}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{t("coaching.noSessionsCreatedDesc")}</p>
                      <Button onClick={() => setShowCreate(true)} size="sm" className="mt-3 bg-gradient-to-r from-primary to-accent text-white gap-1.5">
                        <Plus size={14} /> {t("coaching.hostSession")}
                      </Button>
                    </div>
                  ) : (
                    myCoaching.filter((s: any) => !dismissedSessions.has(s.id)).map((session: any) => (
                      session.status === "cancelled" ? (
                        <SwipeToDeleteCard key={session.id} onDelete={() => setDismissedSessions(prev => new Set(prev).add(session.id))}>
                          <SessionCard session={session} onSelect={setSelectedSessionId} isCoachView />
                        </SwipeToDeleteCard>
                      ) : (
                        <SessionCard key={session.id} session={session} onSelect={setSelectedSessionId} isCoachView />
                      )
                    ))
                  )
                )}
                {mySubTab === "Enrolled" && (
                  myEnrolled.filter((s: any) => !dismissedSessions.has(s.id)).length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/10 flex items-center justify-center mx-auto mb-3">
                        <BookOpen size={24} className="text-primary/50" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">{t("coaching.notEnrolled")}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{t("coaching.notEnrolledDesc")}</p>
                      <Button onClick={() => setMainTab("Explore")} size="sm" className="mt-3 bg-gradient-to-r from-primary to-accent text-white gap-1.5">
                        <GraduationCap size={14} /> {t("coaching.exploreSessions")}
                      </Button>
                    </div>
                  ) : (
                    myEnrolled.filter((s: any) => !dismissedSessions.has(s.id)).map((session: any) => (
                      session.status === "cancelled" ? (
                        <SwipeToDeleteCard key={session.id} onDelete={() => setDismissedSessions(prev => new Set(prev).add(session.id))}>
                          <SessionCard session={session} onSelect={setSelectedSessionId} />
                        </SwipeToDeleteCard>
                      ) : (
                        <SessionCard key={session.id} session={session} onSelect={setSelectedSessionId} />
                      )
                    ))
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ DRILLS TAB ═══ */}
      {mainTab === "Drills" && (
        <div className="animate-slide-up">
          <div className="px-5 pb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
            {drillCategories.map(cat => (
              <button key={cat} onClick={() => setDrillFilter(cat)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                  drillFilter === cat ? "pill-tab-active text-white" : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="px-5 space-y-2.5">
            {filteredDrills.map(drill => (
              <div key={drill.id} className="card-neon rounded-xl p-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center text-xl flex-shrink-0">
                    {drill.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm mb-0.5">{drill.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("sport-badge text-[9px] py-0",
                        drill.level === "Beginner" ? "sport-badge-green" : drill.level === "Intermediate" ? "sport-badge-purple" : "sport-badge-red"
                      )}>{drill.level}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock size={10} /> {drill.duration}</span>
                      <span className="text-[10px] text-muted-foreground">{drill.category}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{drill.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TIPS TAB ═══ */}
      {mainTab === "Tips" && (
        <div className="px-5 space-y-2.5 animate-slide-up">
          {tipOfTheDay.map((tip, i) => (
            <div key={i} className="card-elevated rounded-xl p-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/15 to-orange-500/8 flex items-center justify-center text-lg flex-shrink-0">
                  {tip.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm mb-1">{tip.title}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{tip.tip}</p>
                </div>
              </div>
            </div>
          ))}

          <div className="section-divider" />

          <div className="card-gold rounded-xl p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-orange-500/10 flex items-center justify-center mx-auto mb-2">
              <TrendingUp size={22} className="text-secondary" />
            </div>
            <h3 className="font-bold text-sm mb-1">{t("coaching.wantPersonalizedCoaching")}</h3>
            <p className="text-[11px] text-muted-foreground mb-3">{t("coaching.wantPersonalizedCoachingDesc")}</p>
            <Button onClick={() => setMainTab("Explore")} size="sm" className="bg-gradient-to-r from-secondary to-orange-500 text-secondary-foreground gap-1.5 font-bold">
              <GraduationCap size={14} /> {t("coaching.browseSessions")}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Session Card Component
// ═══════════════════════════════════════════════════════════════════════
function SessionCard({ session, onSelect, isCoachView }: { session: any; onSelect: (id: number) => void; isCoachView?: boolean }) {
  const { t, i18n } = useTranslation();
  const statusColor = session.status === "open" ? "sport-badge-green" : session.status === "full" ? "sport-badge-gold" : session.status === "cancelled" ? "sport-badge-red" : "";
  return (
    <button onClick={() => onSelect(session.id)} className="w-full card-elevated rounded-xl p-4 text-left hover:scale-[1.01] transition-all active:scale-[0.99]">
      <div className="flex items-start gap-3.5">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
          isCoachView ? "bg-gradient-to-br from-secondary/25 to-amber-500/15" : "bg-gradient-to-br from-secondary/20 to-amber-500/10"
        )}>
          <GraduationCap size={20} className="text-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-sm truncate">{session.title}</h3>
            <span className={cn("sport-badge text-[9px] py-0 capitalize", statusColor)}>{session.status}</span>
          </div>
          {session.coachName && (
            <p className="text-xs text-secondary font-semibold mb-1">{t("coaching.coach", { name: session.coachName })}</p>
          )}
          {session.focusAreas && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {session.focusAreas.split(",").slice(0, 3).map((area: string, i: number) => (
                <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-muted/15 text-muted-foreground">{area.trim()}</span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Calendar size={10} className="text-secondary" /> {new Date(session.scheduledAt).toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" })}</span>
            <span className="flex items-center gap-1"><Clock size={10} /> {session.durationMinutes}min</span>
            <span className="flex items-center gap-1"><Users size={10} /> {session.participantCount ?? 0}/{session.maxParticipants}</span>
            {session.costPerPerson > 0 ? <span className="font-semibold">${session.costPerPerson}</span> : <span className="text-secondary font-semibold">{t("coaching.free")}</span>}
            {session.skillLevel && <span className="sport-badge sport-badge-purple text-[8px] py-0">{session.skillLevel}</span>}
          </div>
          {isCoachView && session.agenda && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-green-400">
              <ClipboardList size={10} /> {t("coaching.planAdded")}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Swipe to Delete Wrapper (for cancelled sessions)
// ═══════════════════════════════════════════════════════════════════════
function SwipeToDeleteCard({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    isDraggingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const diff = e.touches[0].clientX - startXRef.current;
    if (diff > 0) return; // only allow left swipe
    currentXRef.current = diff;
    containerRef.current.style.transform = `translateX(${Math.max(diff, -120)}px)`;
    containerRef.current.style.transition = "none";
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (!containerRef.current) return;
    containerRef.current.style.transition = "transform 0.3s ease";
    if (currentXRef.current < -80) {
      containerRef.current.style.transform = "translateX(-100%)";
      containerRef.current.style.opacity = "0";
      setTimeout(onDelete, 300);
    } else {
      containerRef.current.style.transform = "translateX(0)";
    }
    currentXRef.current = 0;
  }, [onDelete]);

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-red-500/30 to-transparent flex items-center justify-end pr-4 pointer-events-none">
        <Trash2 size={18} className="text-red-400" />
      </div>
      <div ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative z-10 bg-background"
      >
        {children}
      </div>
    </div>
  );
}
