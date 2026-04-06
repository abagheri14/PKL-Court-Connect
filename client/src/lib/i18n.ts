import i18n from "i18next";
import { initReactI18next, I18nextProvider, useTranslation } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import React from "react";
import en from "../locales/en.json";
import fr from "../locales/fr.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(I18nextProvider, { i18n }, children);
}

export function useI18n() {
  const { t } = useTranslation();
  const language = i18n.language?.startsWith("fr") ? "fr" : "en";
  const setLanguage = (lng: string) => i18n.changeLanguage(lng);
  return { t, language, setLanguage };
}

export default i18n;
