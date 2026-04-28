"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ko } from "./translations/ko";
import { en } from "./translations/en";

export type Locale = "ko" | "en";

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nState | null>(null);

const STORAGE_KEY = "netpulse_locale";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "ko";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "ko" || stored === "en") return stored;
  const browserLang = navigator.language.slice(0, 2);
  return browserLang === "ko" ? "ko" : "en";
}

const translations: Record<Locale, Record<string, string>> = { ko, en };

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: string): string => {
    return translations[locale][key] ?? key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
