"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet } from "./api";

interface SiteState {
  siteName: string;
  logoUrl: string;
}

const SiteContext = createContext<SiteState>({ siteName: "NetPulse", logoUrl: "" });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteState>({ siteName: "NetPulse", logoUrl: "" });

  useEffect(() => {
    apiGet<{ siteName: string; logoUrl: string }>("/api/setup/site")
      .then((data) => setSite({ siteName: data.siteName || "NetPulse", logoUrl: data.logoUrl || "" }))
      .catch(() => {});
  }, []);

  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteState {
  return useContext(SiteContext);
}
