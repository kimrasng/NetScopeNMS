"use client";

import TopNavigation from "@cloudscape-design/components/top-navigation";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useSite } from "@/lib/site";
import { useRouter } from "next/navigation";

export function TopNav() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { siteName } = useSite();
  const router = useRouter();

  return (
    <TopNavigation
      identity={{
        href: "/dashboard",
        title: siteName,
        onFollow: (e) => {
          e.preventDefault();
          router.push("/dashboard");
        },
      }}
      utilities={[
        {
          type: "button",
          iconName: "notification",
          title: t("topnav.notifications"),
          ariaLabel: t("topnav.notifications"),
          badge: false,
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
            { id: "settings", text: t("topnav.settings") },
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
