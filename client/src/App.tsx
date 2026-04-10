import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider, useApp } from "./contexts/AppContext";
import BottomNav from "./components/BottomNav";
import { OfflineBanner } from "./components/OfflineBanner";
import SplashScreen from "./components/SplashScreen";
import { lazy, Suspense } from "react";

// Pages
import LoginScreen from "./pages/LoginScreen";
import OnboardingFlow from "./pages/OnboardingFlow";
import TutorialOverlay from "./pages/TutorialOverlay";
import HomeDashboard from "./pages/HomeDashboard";
import SwipeDeck from "./pages/SwipeDeck";
import NearbyGrid from "./pages/NearbyGrid";
import MatchesList from "./pages/MatchesList";
import ChatScreen from "./pages/ChatScreen";
import ProfileScreen from "./pages/ProfileScreen";
import PlayerProfile from "./pages/PlayerProfile";
import EditProfile from "./pages/EditProfile";
// Lazy-loaded: pulls in ~200KB Mapbox GL JS only when needed
const CourtsScreen = lazy(() => import("./pages/CourtsScreen"));
const CourtDetail = lazy(() => import("./pages/CourtDetail"));
import GameHistory from "./pages/GameHistory";
import CreateGameScreen from "./pages/CreateGameScreen";
import AchievementsScreen from "./pages/AchievementsScreen";
import SettingsScreen from "./pages/SettingsScreen";
import HelpScreen from "./pages/HelpScreen";
import PremiumScreen from "./pages/PremiumScreen";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import NotificationsScreen from "./pages/NotificationsScreen";
import LeaderboardScreen from "./pages/LeaderboardScreen";
import GroupsScreen from "./pages/GroupsScreen";
import CoachingScreen from "./pages/CoachingScreen";
import PendingRequestsScreen from "./pages/PendingRequestsScreen";
import GamePlayScreen from "./pages/GamePlayScreen";
const SubmitCourtScreen = lazy(() => import("./pages/SubmitCourtScreen"));
import TournamentsScreen from "./pages/TournamentsScreen";
import TournamentDetailScreen from "./pages/TournamentDetailScreen";
import CreateTournamentScreen from "./pages/CreateTournamentScreen";
import ActivityFeedScreen from "./pages/ActivityFeedScreen";
import FavoritePlayersScreen from "./pages/FavoritePlayersScreen";
import ReferralsScreen from "./pages/ReferralsScreen";
import ChallengeOverlay from "./components/ChallengeOverlay";
import MatchCelebration from "./components/MatchCelebration";
import LevelUpCelebration from "./components/LevelUpCelebration";
import GameWinCelebration from "./components/GameWinCelebration";

const screensWithoutBottomNav = new Set([
  "login", "onboarding", "tutorial",
]);

function AppRouter() {
  const { screen, isLoading, isAuthenticated, pendingMatchPlayer, clearPendingMatch, pendingLevelUp, clearPendingLevelUp, pendingGameWin, clearPendingGameWin, setActiveTab } = useApp();

  if (isLoading) return <SplashScreen />;

  const renderScreen = () => {
    switch (screen) {
      case "login":
        return <LoginScreen />;
      case "onboarding":
        return <OnboardingFlow />;
      case "tutorial":
        return <TutorialOverlay />;
      case "home":
        return <HomeDashboard />;
      case "swipe":
        return <SwipeDeck />;
      case "nearby":
        return <NearbyGrid />;
      case "matches":
        return <MatchesList />;
      case "chat":
        return <ChatScreen />;
      case "profile":
        return <ProfileScreen />;
      case "playerProfile":
        return <PlayerProfile />;
      case "editProfile":
        return <EditProfile />;
      case "courts":
        return <CourtsScreen />;
      case "courtDetail":
        return <CourtDetail />;
      case "gameHistory":
        return <GameHistory />;
      case "createGame":
        return <CreateGameScreen />;
      case "achievements":
        return <AchievementsScreen />;
      case "settings":
        return <SettingsScreen />;
      case "help":
        return <HelpScreen />;
      case "premium":
        return <PremiumScreen />;
      case "admin":
        return <AdminDashboard />;
      case "superadmin":
        return <SuperAdminDashboard />;
      case "notifications":
        return <NotificationsScreen />;
      case "leaderboard":
        return <LeaderboardScreen />;
      case "groups":
        return <GroupsScreen />;
      case "coaching":
        return <CoachingScreen />;
      case "pending":
        return <PendingRequestsScreen />;
      case "gamePlay":
        return <GamePlayScreen />;
      case "submitCourt":
        return <SubmitCourtScreen />;
      case "tournaments":
        return <TournamentsScreen />;
      case "tournamentDetail":
        return <TournamentDetailScreen />;
      case "createTournament":
        return <CreateTournamentScreen />;
      case "activityFeed":
        return <ActivityFeedScreen />;
      case "favoritePlayers":
        return <FavoritePlayersScreen />;
      case "referrals":
        return <ReferralsScreen />;
      default:
        return <HomeDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <OfflineBanner />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        {renderScreen()}
      </Suspense>
      {!screensWithoutBottomNav.has(screen) && isAuthenticated && <BottomNav />}
      {isAuthenticated && <ChallengeOverlay />}
      {pendingMatchPlayer && (
        <MatchCelebration
          player={pendingMatchPlayer}
          onClose={clearPendingMatch}
          onMessage={() => {
            clearPendingMatch();
            setActiveTab("matches");
          }}
        />
      )}
      {pendingLevelUp != null && (
        <LevelUpCelebration newLevel={pendingLevelUp} onClose={clearPendingLevelUp} />
      )}
      {pendingGameWin != null && (
        <GameWinCelebration gameType={pendingGameWin.gameType as any} onClose={clearPendingGameWin} />
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <AppProvider>
            <AppRouter />
          </AppProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
