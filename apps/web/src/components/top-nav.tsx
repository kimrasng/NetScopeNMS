"use client";

import TopNavigation from "@cloudscape-design/components/top-navigation";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useSite } from "@/lib/site";
import { useRouter } from "next/navigation";

export function TopNav() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { siteName, logoUrl } = useSite();
  const router = useRouter();

  return (
    <TopNavigation
      identity={{
        href: "/dashboard",
        title: siteName,
        logo: logoUrl ? { src: logoUrl, alt: siteName } : undefined,
        onFollow: (e) => {
          e.preventDefault();
          router.push("/dashboard");
        },
      }}
      utilities={[
        {
          type: "button",
          text: t("Channel settings"),
          title: t("Channel settings"),
          ariaLabel: t("Channel settings"),
          onClick: () => router.push("/notifications"),
        },
        {
          type: "menu-dropdown",
          text: user?.name || "User",
          description: user?.email || "",
          iconName: "user-profile",
          items: [
            { id: "profile", text: t("topnav.profile") },
            { id: "preferences", text: t("nav.preferences") },
            ...(user?.scope === "all" && (user.role === "admin" || user.role === "super_admin") ? [{ id: "settings", text: t("topnav.settings") }] : []),
            { id: "signout", text: t("topnav.signout") },
          ],
          onItemClick: ({ detail }) => {
            switch (detail.id) {
              case "profile":
                router.push("/settings/profile");
                break;
              case "preferences":
                router.push("/settings/preferences");
                break;
              case "settings":
                router.push("/settings/site");
                break;
              case "signout":
                logout();
                break;
            }
          },
        },
      ]}
    />
  );
}
