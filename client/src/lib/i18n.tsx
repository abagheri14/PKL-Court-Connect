import React, { createContext, useContext, useState, useCallback } from "react";

export type Language = "en" | "fr";

const translations: Record<string, Record<Language, string>> = {
  // Navigation
  "nav.home": { en: "Home", fr: "Accueil" },
  "nav.swipe": { en: "Swipe", fr: "Balayer" },
  "nav.matches": { en: "Matches", fr: "Matchs" },
  "nav.profile": { en: "Profile", fr: "Profil" },
  
  // Home Dashboard
  "home.welcome": { en: "Welcome back", fr: "Bon retour" },
  "home.quickActions": { en: "Quick Actions", fr: "Actions rapides" },
  "home.findPlayers": { en: "Find Players", fr: "Trouver des joueurs" },
  "home.findCourts": { en: "Find Courts", fr: "Trouver des terrains" },
  "home.createGame": { en: "Create Game", fr: "Créer une partie" },
  "home.coaching": { en: "Coaching", fr: "Coaching" },
  "home.recentMatches": { en: "Recent Matches", fr: "Matchs récents" },
  "home.upcomingGames": { en: "Upcoming Games", fr: "Parties à venir" },
  "home.achievements": { en: "Achievements", fr: "Réalisations" },
  "home.noUpcoming": { en: "No upcoming games", fr: "Aucune partie à venir" },
  "home.viewAll": { en: "View All", fr: "Voir tout" },
  
  // Swipe Deck
  "swipe.title": { en: "Swipe Deck", fr: "Cartes de joueurs" },
  "swipe.nearby": { en: "players nearby", fr: "joueurs à proximité" },
  "swipe.noMore": { en: "No more players", fr: "Plus de joueurs" },
  "swipe.checkBack": { en: "Check back later for new players in your area!", fr: "Revenez plus tard pour de nouveaux joueurs!" },
  "swipe.browseNearby": { en: "Browse Nearby", fr: "Voir les environs" },
  "swipe.dailyLimit": { en: "Daily Limit Reached", fr: "Limite quotidienne atteinte" },
  "swipe.upgradePremium": { en: "Upgrade to Premium for unlimited swipes!", fr: "Passez à Premium pour des balayages illimités!" },
  "swipe.goPremium": { en: "Go Premium", fr: "Passer Premium" },
  "swipe.match": { en: "It's a Rally!", fr: "C'est un Rally!" },
  
  // Profile
  "profile.editProfile": { en: "Edit Profile", fr: "Modifier le profil" },
  "profile.fullName": { en: "Full Name", fr: "Nom complet" },
  "profile.nickname": { en: "Nickname", fr: "Surnom" },
  "profile.bio": { en: "Bio", fr: "Bio" },
  "profile.skillLevel": { en: "Skill Level", fr: "Niveau" },
  "profile.vibe": { en: "Vibe", fr: "Ambiance" },
  "profile.playStyle": { en: "Play Style", fr: "Style de jeu" },
  "profile.photos": { en: "Photos", fr: "Photos" },
  "profile.save": { en: "Save", fr: "Sauvegarder" },
  "profile.showFullName": { en: "Show Full Name", fr: "Afficher le nom complet" },
  
  // Settings
  "settings.title": { en: "Settings & Privacy", fr: "Paramètres et confidentialité" },
  "settings.notifications": { en: "Notifications", fr: "Notifications" },
  "settings.pushNotifications": { en: "Push Notifications", fr: "Notifications push" },
  "settings.newMatches": { en: "New Matches", fr: "Nouveaux matchs" },
  "settings.messages": { en: "Messages", fr: "Messages" },
  "settings.gameReminders": { en: "Game Reminders", fr: "Rappels de partie" },
  "settings.privacy": { en: "Privacy", fr: "Confidentialité" },
  "settings.showDistance": { en: "Show Distance", fr: "Afficher la distance" },
  "settings.onlineStatus": { en: "Online Status", fr: "Statut en ligne" },
  "settings.publicProfile": { en: "Public Profile", fr: "Profil public" },
  "settings.ghostMode": { en: "Ghost Mode", fr: "Mode fantôme" },
  "settings.display": { en: "Display", fr: "Affichage" },
  "settings.theme": { en: "Theme", fr: "Thème" },
  "settings.language": { en: "Language", fr: "Langue" },
  "settings.textSize": { en: "Text Size", fr: "Taille du texte" },
  "settings.account": { en: "Account", fr: "Compte" },
  "settings.changePassword": { en: "Change Password", fr: "Changer le mot de passe" },
  "settings.verifyEmail": { en: "Verify Email", fr: "Vérifier l'e-mail" },
  "settings.blockedUsers": { en: "Blocked Users", fr: "Utilisateurs bloqués" },
  "settings.downloadData": { en: "Download My Data", fr: "Télécharger mes données" },
  "settings.logOut": { en: "Log Out", fr: "Déconnexion" },
  "settings.deleteAccount": { en: "Delete Account", fr: "Supprimer le compte" },
  "settings.dark": { en: "Dark", fr: "Sombre" },
  "settings.light": { en: "Light", fr: "Clair" },
  "settings.emailVerified": { en: "Email Verified", fr: "E-mail vérifié" },
  "settings.noBlockedUsers": { en: "No blocked users", fr: "Aucun utilisateur bloqué" },
  
  // Courts
  "courts.title": { en: "Find Courts", fr: "Trouver des terrains" },
  "courts.searchPlaceholder": { en: "Search courts by name or address...", fr: "Rechercher des terrains..." },
  "courts.nearby": { en: "nearby", fr: "à proximité" },
  "courts.free": { en: "Free", fr: "Gratuit" },
  "courts.paid": { en: "Paid", fr: "Payant" },
  "courts.indoor": { en: "Indoor", fr: "Intérieur" },
  "courts.outdoor": { en: "Outdoor", fr: "Extérieur" },
  "courts.all": { en: "All", fr: "Tous" },
  
  // Achievements
  "achievements.title": { en: "Achievements", fr: "Réalisations" },
  "achievements.earned": { en: "Earned", fr: "Obtenues" },
  "achievements.locked": { en: "Locked", fr: "Verrouillées" },
  "achievements.complete": { en: "Complete", fr: "Complété" },
  "achievements.claim": { en: "Claim", fr: "Réclamer" },
  "achievements.claimed": { en: "Claimed", fr: "Réclamé" },
  
  // Chat
  "chat.encrypted": { en: "Encrypted", fr: "Chiffré" },
  "chat.typeMessage": { en: "Type a message...", fr: "Écrire un message..." },
  "chat.unmatch": { en: "Unmatch", fr: "Se désabonner" },
  
  // Games
  "games.title": { en: "Games", fr: "Parties" },
  "games.upcoming": { en: "Upcoming", fr: "À venir" },
  "games.past": { en: "Past", fr: "Passées" },
  "games.joinGame": { en: "Join Game", fr: "Rejoindre la partie" },
  "games.pending": { en: "Pending Approval", fr: "En attente d'approbation" },
  "games.approved": { en: "Approved", fr: "Approuvé" },
  "games.createGame": { en: "Create Game", fr: "Créer une partie" },
  
  // Coaching
  "coaching.title": { en: "Coaching", fr: "Coaching" },
  "coaching.explore": { en: "Explore", fr: "Explorer" },
  "coaching.mySessions": { en: "My Sessions", fr: "Mes séances" },
  "coaching.drills": { en: "Drills", fr: "Exercices" },
  "coaching.tips": { en: "Tips", fr: "Conseils" },
  "coaching.virtual": { en: "Virtual", fr: "Virtuel" },
  "coaching.inPerson": { en: "In Person", fr: "En personne" },
  "coaching.location": { en: "Location", fr: "Lieu" },
  "coaching.pending": { en: "Pending Approval", fr: "En attente d'approbation" },
  
  // Groups
  "groups.title": { en: "Groups", fr: "Groupes" },
  "groups.chat": { en: "Chat", fr: "Discussion" },
  "groups.info": { en: "Info", fr: "Info" },
  "groups.members": { en: "Members", fr: "Membres" },
  "groups.games": { en: "Games", fr: "Parties" },
  
  // Common
  "common.loading": { en: "Loading...", fr: "Chargement..." },
  "common.save": { en: "Save", fr: "Sauvegarder" },
  "common.cancel": { en: "Cancel", fr: "Annuler" },
  "common.confirm": { en: "Confirm", fr: "Confirmer" },
  "common.delete": { en: "Delete", fr: "Supprimer" },
  "common.edit": { en: "Edit", fr: "Modifier" },
  "common.back": { en: "Back", fr: "Retour" },
  "common.search": { en: "Search", fr: "Rechercher" },
  "common.send": { en: "Send", fr: "Envoyer" },
  "common.close": { en: "Close", fr: "Fermer" },
  "common.yes": { en: "Yes", fr: "Oui" },
  "common.no": { en: "No", fr: "Non" },
  "common.unblock": { en: "Unblock", fr: "Débloquer" },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem("pkl_language");
      return (stored === "fr" ? "fr" : "en") as Language;
    } catch {
      return "en";
    }
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem("pkl_language", lang); } catch { /* noop */ }
  }, []);

  const t = useCallback((key: string): string => {
    return translations[key]?.[language] ?? key;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
