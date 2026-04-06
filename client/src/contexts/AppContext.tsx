import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

/** Extract human-readable message from tRPC/Zod error */
function parseErrorMessage(err: any, fallback: string): string {
  const raw = err?.message ?? fallback;
  try {
    const issues = JSON.parse(raw);
    if (Array.isArray(issues) && issues.length > 0) {
      return issues.map((i: any) => {
        const field = i.path?.length ? `${i.path.join(".")}: ` : "";
        return `${field}${i.message}`;
      }).join(". ");
    }
  } catch { /* not JSON, use raw */ }
  return raw;
}
import { usePushNotifications } from "@/hooks/usePushNotifications";

// ── Session storage keys for screen persistence across refresh ──────────────
const SS_SCREEN = "pkl_screen";
const SS_TAB = "pkl_tab";
const SS_GAME_ID = "pkl_gameId";
const SS_TOURNAMENT_ID = "pkl_tournamentId";
const SS_MATCH_ID = "pkl_matchId";
const SS_CONV_ID = "pkl_convId";
const SS_COURT_ID = "pkl_courtId";
const SS_PLAYER_ID = "pkl_playerId";
const SS_HISTORY = "pkl_history";

// ── Types ────────────────────────────────────────────────────────────────────

export type AppScreen =
  | "login"
  | "onboarding"
  | "tutorial"
  | "home"
  | "swipe"
  | "nearby"
  | "matches"
  | "chat"
  | "profile"
  | "editProfile"
  | "courts"
  | "courtDetail"
  | "gameHistory"
  | "createGame"
  | "achievements"
  | "settings"
  | "help"
  | "premium"
  | "admin"
  | "superadmin"
  | "notifications"
  | "playerProfile"
  | "leaderboard"
  | "groups"
  | "coaching"
  | "pending"
  | "gamePlay"
  | "submitCourt"
  | "tournaments"
  | "tournamentDetail"
  | "createTournament"
  | "activityFeed"
  | "favoritePlayers"
  | "referrals";

interface AppContextType {
  // Navigation
  screen: AppScreen;
  navigate: (screen: AppScreen) => void;
  goBack: () => void;
  activeTab: "home" | "swipe" | "nearby" | "matches" | "profile" | "activityFeed";
  setActiveTab: (tab: "home" | "swipe" | "nearby" | "matches" | "profile" | "activityFeed") => void;

  // Auth state
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: { email: string; username: string; password: string; name?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refetchUser: () => void;

  // Selection state (for navigating to detail pages)
  selectedMatchId: number | null;
  selectedConversationId: number | null;
  selectedCourtId: number | null;
  selectedPlayerId: number | null;
  selectMatch: (matchId: number | null, conversationId?: number | null) => void;
  selectCourt: (courtId: number | null) => void;
  selectPlayer: (playerId: number | null) => void;
  selectedGameId: number | null;
  selectGame: (gameId: number | null) => void;
  createGameGroupId: number | null;
  setCreateGameGroupId: (groupId: number | null) => void;
  selectedTournamentId: number | null;
  selectTournament: (tournamentId: number | null) => void;

  // Ghost mode
  ghostMode: boolean;
  toggleGhostMode: () => void;

  // Read receipts
  readReceipts: boolean;
  toggleReadReceipts: () => void;

  // Match celebration (triggered from real-time notifications)
  pendingMatchPlayer: any | null;
  clearPendingMatch: () => void;
  // Level-up / game-win celebrations
  pendingLevelUp: number | null;
  clearPendingLevelUp: () => void;
  pendingGameWin: { gameType?: string } | null;
  clearPendingGameWin: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<AppScreen>("login");
  const [screenHistory, setScreenHistory] = useState<AppScreen[]>([]);
  const [activeTab, setActiveTabState] = useState<"home" | "swipe" | "nearby" | "matches" | "profile" | "activityFeed">("home");
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [createGameGroupId, setCreateGameGroupId] = useState<number | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [pendingMatchPlayer, setPendingMatchPlayer] = useState<any | null>(null);
  const [pendingLevelUp, setPendingLevelUp] = useState<number | null>(null);
  const [pendingGameWin, setPendingGameWin] = useState<{ gameType?: string } | null>(null);

  // ── Auth: check if user is already logged in ──────────────────────────
  const userQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation();
  const signupMutation = trpc.auth.signup.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  const user = userQuery.data ?? null;
  const isAuthenticated = !!user;
  const isLoading = userQuery.isLoading;

  // ── Push notifications (auto-subscribes when authenticated) ───────────
  usePushNotifications(isAuthenticated);

  // ── Auto-sync geolocation to server when authenticated ────────────────
  const updateLocationMutation = trpc.users.updateLocation.useMutation();
  const updateLocationRef = useRef(updateLocationMutation.mutate);
  updateLocationRef.current = updateLocationMutation.mutate;
  useEffect(() => {
    if (!isAuthenticated || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) {
          updateLocationRef.current({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        }
      },
      () => {}, // silently ignore errors
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Navigate based on auth state
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setScreen("login");
      // Clear persisted state on logout
      sessionStorage.removeItem(SS_SCREEN);
      sessionStorage.removeItem(SS_TAB);
      sessionStorage.removeItem(SS_GAME_ID);
      sessionStorage.removeItem(SS_TOURNAMENT_ID);
      sessionStorage.removeItem(SS_MATCH_ID);
      sessionStorage.removeItem(SS_CONV_ID);
      sessionStorage.removeItem(SS_COURT_ID);
      sessionStorage.removeItem(SS_PLAYER_ID);
      sessionStorage.removeItem(SS_HISTORY);
      return;
    }
    // User is authenticated
    if (!user.onboardingCompleted) {
      setScreen("onboarding");
    } else if (screen === "login" || screen === "onboarding") {
      // Restore persisted screen from sessionStorage, or default to "home"
      const savedScreen = sessionStorage.getItem(SS_SCREEN) as AppScreen | null;
      if (savedScreen && savedScreen !== "login" && savedScreen !== "onboarding") {
        setScreen(savedScreen);
        const savedTab = sessionStorage.getItem(SS_TAB) as typeof activeTab | null;
        if (savedTab) setActiveTabState(savedTab);
        const sg = sessionStorage.getItem(SS_GAME_ID);
        if (sg) setSelectedGameId(Number(sg));
        const st = sessionStorage.getItem(SS_TOURNAMENT_ID);
        if (st) setSelectedTournamentId(Number(st));
        const sm = sessionStorage.getItem(SS_MATCH_ID);
        if (sm) setSelectedMatchId(Number(sm));
        const sc = sessionStorage.getItem(SS_CONV_ID);
        if (sc) setSelectedConversationId(Number(sc));
        const sco = sessionStorage.getItem(SS_COURT_ID);
        if (sco) setSelectedCourtId(Number(sco));
        const sp = sessionStorage.getItem(SS_PLAYER_ID);
        if (sp) setSelectedPlayerId(Number(sp));
        const sh = sessionStorage.getItem(SS_HISTORY);
        if (sh) {
          try { setScreenHistory(JSON.parse(sh)); } catch {}
        }
      } else {
        setScreen("home");
        setActiveTabState("home");
      }
    }
    // Connect WebSocket when authenticated
    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, isLoading, user?.onboardingCompleted]);

  // ── Persist navigation state to sessionStorage ────────────────────────
  useEffect(() => {
    if (screen !== "login" && screen !== "onboarding") {
      sessionStorage.setItem(SS_SCREEN, screen);
    }
  }, [screen]);

  useEffect(() => {
    sessionStorage.setItem(SS_TAB, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedGameId !== null) sessionStorage.setItem(SS_GAME_ID, String(selectedGameId));
    else sessionStorage.removeItem(SS_GAME_ID);
  }, [selectedGameId]);

  useEffect(() => {
    if (selectedTournamentId !== null) sessionStorage.setItem(SS_TOURNAMENT_ID, String(selectedTournamentId));
    else sessionStorage.removeItem(SS_TOURNAMENT_ID);
  }, [selectedTournamentId]);

  useEffect(() => {
    if (selectedMatchId !== null) sessionStorage.setItem(SS_MATCH_ID, String(selectedMatchId));
    else sessionStorage.removeItem(SS_MATCH_ID);
  }, [selectedMatchId]);

  useEffect(() => {
    if (selectedConversationId !== null) sessionStorage.setItem(SS_CONV_ID, String(selectedConversationId));
    else sessionStorage.removeItem(SS_CONV_ID);
  }, [selectedConversationId]);

  useEffect(() => {
    if (selectedCourtId !== null) sessionStorage.setItem(SS_COURT_ID, String(selectedCourtId));
    else sessionStorage.removeItem(SS_COURT_ID);
  }, [selectedCourtId]);

  useEffect(() => {
    if (selectedPlayerId !== null) sessionStorage.setItem(SS_PLAYER_ID, String(selectedPlayerId));
    else sessionStorage.removeItem(SS_PLAYER_ID);
  }, [selectedPlayerId]);

  useEffect(() => {
    sessionStorage.setItem(SS_HISTORY, JSON.stringify(screenHistory));
  }, [screenHistory]);

  // ── Real-time notification listener (Tinder-style banners + navigation) ──
  const utils = trpc.useUtils();
  // Refs for stable access inside the socket handler (avoids stale closures)
  const navigateRef = React.useRef<(s: AppScreen) => void>(() => {});
  const selectGameRef = React.useRef<(id: number | null) => void>(() => {});
  const setActiveTabRef = React.useRef<(tab: "home" | "swipe" | "nearby" | "matches" | "profile") => void>(() => {});

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    if (!socket.connected) return;
    const handleNotification = (notification: any) => {
      // Invalidate notification caches (BottomNav badge + NotificationsScreen)
      utils.notifications.list.invalidate();

      const type = notification?.type;
      const title = notification?.title || notification?.message || "New notification";
      const body = notification?.body || notification?.description || "";

      // ── Match notification → show full-screen celebration ──
      if (type === "match" && notification?.matchedUser) {
        setPendingMatchPlayer(notification.matchedUser);
        return; // celebration overlay handles everything
      }

      // ── Level-up notification ──
      if (type === "level_up" && notification?.newLevel) {
        setPendingLevelUp(Number(notification.newLevel));
        return;
      }

      // ── Game win notification ──
      if (type === "game_won" || type === "tournament_won") {
        setPendingGameWin({ gameType: type === "tournament_won" ? "tournament" : "casual" });
        return;
      }

      // ── Game invite / game started → actionable banner ──
      if (type === "game_invite" && notification?.gameId) {
        const gid = Number(notification.gameId);
        // Invalidate game caches so GameHistory/HomeDashboard update live
        utils.games.upcoming.invalidate();
        utils.games.list.invalidate();
        toast.custom((toastId) => (
          <div
            onClick={() => { toast.dismiss(toastId); selectGameRef.current(gid); }}
            className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-primary/95 to-accent/90 text-white border border-primary/30 shadow-2xl py-4 px-5"
          >
            <p className="font-semibold text-base">{title}</p>
            <p className="text-sm opacity-90 mt-0.5">{body}</p>
          </div>
        ), { duration: 12000, position: "top-center" });
        return;
      }

      // ── Match (without matchedUser payload) → navigate to matches ──
      if (type === "match") {
        utils.matches.list.invalidate();
        toast(title, {
          description: body,
          duration: 12000,
          position: "top-center",
          action: {
            label: t("common.viewMatches"),
            onClick: () => setActiveTabRef.current("matches"),
          },
          className: "!bg-gradient-to-r !from-pink-500/95 !to-rose-500/90 !text-white !border-pink-400/30 !shadow-2xl !text-base !py-4 !px-5 !rounded-2xl",
        });
        return;
      }

      // ── Challenge notification → navigate to challenges ──
      if (type === "challenge") {
        utils.challenges.allPending.invalidate();
        toast(title, {
          description: body,
          duration: 12000,
          position: "top-center",
          action: {
            label: t("common.view"),
            onClick: () => navigateRef.current("pending"),
          },
          className: "!bg-gradient-to-r !from-orange-500/95 !to-amber-500/90 !text-white !border-orange-400/30 !shadow-2xl !text-base !py-4 !px-5 !rounded-2xl",
        });
        return;
      }

      // ── Achievement notification → navigate to achievements ──
      if (type === "achievement") {
        utils.achievements.list.invalidate();
        toast(title, {
          description: body,
          duration: 12000,
          position: "top-center",
          action: {
            label: t("common.view"),
            onClick: () => navigateRef.current("achievements"),
          },
          className: "!bg-gradient-to-r !from-yellow-500/95 !to-amber-400/90 !text-white !border-yellow-400/30 !shadow-2xl !text-base !py-4 !px-5 !rounded-2xl",
        });
        return;
      }

      // ── Endorsement notification → navigate to profile ──
      if (type === "endorsement") {
        utils.users.getEndorsements.invalidate();
        toast(title, {
          description: body,
          duration: 12000,
          position: "top-center",
          action: {
            label: t("common.view"),
            onClick: () => navigateRef.current("profile"),
          },
          className: "!bg-gradient-to-r !from-emerald-500/95 !to-green-500/90 !text-white !border-emerald-400/30 !shadow-2xl !text-base !py-4 !px-5 !rounded-2xl",
        });
        return;
      }

      // ── Group join request → invalidate group caches for admin ──
      if (type === "group_join_request") {
        utils.groups.myGroups.invalidate();
        utils.groups.getById.invalidate();
        utils.groups.getMembers.invalidate();
        toast(title, {
          description: body,
          duration: 12000,
          position: "top-center",
          className: "!bg-gradient-to-r !from-blue-500/95 !to-indigo-500/90 !text-white !border-blue-400/30 !shadow-2xl !text-base !py-4 !px-5 !rounded-2xl",
        });
        return;
      }

      // ── Group approved → invalidate group caches for the user ──
      if (type === "group_approved") {
        utils.groups.myGroups.invalidate();
        utils.groups.list.invalidate();
        utils.groups.getById.invalidate();
        toast(title, {
          description: body,
          duration: 12000,
          position: "top-center",
          className: "!bg-gradient-to-r !from-emerald-500/95 !to-green-500/90 !text-white !border-emerald-400/30 !shadow-2xl !text-base !py-4 !px-5 !rounded-2xl",
        });
        return;
      }

      // ── All other notifications → standard Tinder-style banner ──
      toast(title, {
        description: body,
        duration: 10000,
        position: "top-center",
        className: "!bg-gradient-to-r !from-background/98 !to-background/95 !border-primary/20 !shadow-2xl !text-base !py-4 !px-5 !rounded-2xl",
      });
    };
    socket.on("notification", handleNotification);
    return () => {
      socket.off("notification", handleNotification);
    };
  }, [isAuthenticated, utils]);

  const goBack = useCallback(() => {
    setScreenHistory(prev => {
      if (prev.length === 0) {
        // Fallback: if history is empty (e.g. after page refresh), go home
        setScreen("home");
        setActiveTabState("home");
        return prev;
      }
      const newHistory = [...prev];
      const prevScreen = newHistory.pop()!;
      setScreen(prevScreen);
      // Sync activeTab if going back to a tab screen
      const tabScreens = ["home", "swipe", "nearby", "matches", "profile"] as const;
      if ((tabScreens as readonly string[]).includes(prevScreen)) {
        setActiveTabState(prevScreen as typeof activeTab);
      }
      return newHistory;
    });
  }, []);

  // Android hardware back button / browser back support
  useEffect(() => {
    const handlePopState = () => {
      goBack();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [goBack]);

  // Push state on every navigate so popstate fires
  useEffect(() => {
    if (screen !== "login") {
      window.history.pushState({ screen }, "", "");
    }
  }, [screen]);

  const navigate = useCallback((s: AppScreen) => {
    // Use setScreen's functional updater to capture the current screen
    // without relying on a stale closure reference
    setScreen((currentScreen) => {
      setScreenHistory(prev => [...prev, currentScreen]);
      return s;
    });
  }, []);

  const setActiveTab = useCallback((tab: "home" | "swipe" | "nearby" | "matches" | "profile" | "activityFeed") => {
    setScreenHistory([]); // reset history on tab switch
    setActiveTabState(tab);
    setScreen(tab);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      if (result.success) {
        await userQuery.refetch();
        return { success: true };
      }
      return { success: false, error: result.error || "Login failed" };
    } catch (err: any) {
      return { success: false, error: parseErrorMessage(err, "Login failed") };
    }
  }, [loginMutation, userQuery]);

  const signup = useCallback(async (data: { email: string; username: string; password: string; name?: string }) => {
    try {
      const result = await signupMutation.mutateAsync(data);
      if (result.success) {
        await userQuery.refetch();
        return { success: true };
      }
      return { success: false, error: result.error || "Signup failed" };
    } catch (err: any) {
      return { success: false, error: parseErrorMessage(err, "Signup failed") };
    }
  }, [signupMutation, userQuery]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {}
    disconnectSocket();
    userQuery.refetch();
    setScreen("login");
  }, [logoutMutation, userQuery]);

  const refetchUser = useCallback(() => {
    userQuery.refetch();
  }, [userQuery]);

  const selectMatch = useCallback((matchId: number | null, conversationId?: number | null) => {
    setSelectedMatchId(matchId);
    setSelectedConversationId(conversationId ?? null);
    if (matchId !== null || conversationId) {
      setScreen(prev => { setScreenHistory(h => [...h, prev]); return "chat"; });
    }
  }, []);

  const selectCourt = useCallback((id: number | null) => {
    setSelectedCourtId(id);
    if (id !== null) {
      setScreen(prev => { setScreenHistory(h => [...h, prev]); return "courtDetail"; });
    }
  }, []);

  const selectPlayer = useCallback((id: number | null) => {
    setSelectedPlayerId(id);
    if (id !== null) {
      setScreen(prev => { setScreenHistory(h => [...h, prev]); return "playerProfile"; });
    }
  }, []);

  const selectGame = useCallback((id: number | null) => {
    setSelectedGameId(id);
    if (id !== null) {
      setScreen(prev => { setScreenHistory(h => [...h, prev]); return "gamePlay"; });
    }
  }, []);

  const selectTournament = useCallback((id: number | null) => {
    setSelectedTournamentId(id);
    if (id !== null) {
      setScreen(prev => { setScreenHistory(h => [...h, prev]); return "tournamentDetail"; });
    }
  }, []);

  const clearPendingMatch = useCallback(() => setPendingMatchPlayer(null), []);
  const clearPendingLevelUp = useCallback(() => setPendingLevelUp(null), []);
  const clearPendingGameWin = useCallback(() => setPendingGameWin(null), []);

  // Keep refs in sync so the socket handler always uses the latest callbacks
  navigateRef.current = navigate;
  selectGameRef.current = selectGame;
  setActiveTabRef.current = setActiveTab;

  const ghostMode = user?.ghostMode ?? false;
  const ghostModeMutation = trpc.users.toggleGhostMode.useMutation({
    onSuccess: () => { userQuery.refetch(); },
  });
  const toggleGhostMode = useCallback(() => {
    ghostModeMutation.mutate({ enabled: !ghostMode });
  }, [ghostMode]);

  const readReceipts = user?.readReceipts ?? false;
  const readReceiptsMutation = trpc.users.toggleReadReceipts.useMutation({
    onSuccess: () => { userQuery.refetch(); },
  });
  const toggleReadReceipts = useCallback(() => {
    readReceiptsMutation.mutate({ enabled: !readReceipts });
  }, [readReceipts]);

  return (
    <AppContext.Provider
      value={{
        screen,
        navigate,
        goBack,
        activeTab,
        setActiveTab,
        user,
        isAuthenticated,
        isLoading,
        login,
        signup,
        logout,
        refetchUser,
        selectedMatchId,
        selectedConversationId,
        selectedCourtId,
        selectedPlayerId,
        selectMatch,
        selectCourt,
        selectPlayer,
        selectedGameId,
        selectGame,
        createGameGroupId,
        setCreateGameGroupId,
        selectedTournamentId,
        selectTournament,
        ghostMode,
        toggleGhostMode,
        readReceipts,
        toggleReadReceipts,
        pendingMatchPlayer,
        clearPendingMatch,
        pendingLevelUp,
        clearPendingLevelUp,
        pendingGameWin,
        clearPendingGameWin,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
