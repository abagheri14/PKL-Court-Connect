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
// Lazy-loaded: heavy dependencies or infrequently visited screens
const CourtsScreen = lazy(() => import("./pages/CourtsScreen"));
const CourtDetail = lazy(() => import("./pages/CourtDetail"));
const SubmitCourtScreen = lazy(() => import("./pages/SubmitCourtScreen"));
const GameHistory = lazy(() => import("./pages/GameHistory"));
const CreateGameScreen = lazy(() => import("./pages/CreateGameScreen"));
const AchievementsScreen = lazy(() => import("./pages/AchievementsScreen"));
const PremiumScreen = lazy(() => import("./pages/PremiumScreen"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const LeaderboardScreen = lazy(() => import("./pages/LeaderboardScreen"));
const GroupsScreen = lazy(() => import("./pages/GroupsScreen"));
const CoachingScreen = lazy(() => import("./pages/CoachingScreen"));
const GamePlayScreen = lazy(() => import("./pages/GamePlayScreen"));
const TournamentsScreen = lazy(() => import("./pages/TournamentsScreen"));
const TournamentDetailScreen = lazy(() => import("./pages/TournamentDetailScreen"));
const CreateTournamentScreen = lazy(() => import("./pages/CreateTournamentScreen"));
const ActivityFeedScreen = lazy(() => import("./pages/ActivityFeedScreen"));
const FavoritePlayersScreen = lazy(() => import("./pages/FavoritePlayersScreen"));
const ReferralsScreen = lazy(() => import("./pages/ReferralsScreen"));
import SettingsScreen from "./pages/SettingsScreen";
import HelpScreen from "./pages/HelpScreen";
import NotificationsScreen from "./pages/NotificationsScreen";
import PendingRequestsScreen from "./pages/PendingRequestsScreen";
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
