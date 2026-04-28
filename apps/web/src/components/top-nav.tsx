"use client";

import TopNavigation from "@cloudscape-design/components/top-navigation";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

export function TopNav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <TopNavigation
      identity={{
        href: "/dashboard",
        title: "NetPulse",
        onFollow: (e) => {
          e.preventDefault();
          router.push("/dashboard");
        },
      }}
      utilities={[
        {
          type: "button",
          iconName: "notification",
          title: "Notifications",
          ariaLabel: "Notifications",
          badge: false,
          onClick: () => router.push("/notifications"),
        },
        {
          type: "menu-dropdown",
          text: user?.name || "User",
          description: user?.email || "",
          iconName: "user-profile",
          items: [
            { id: "profile", text: "Profile" },
            { id: "settings", text: "Settings" },
            { id: "signout", text: "Sign out" },
          ],
          onItemClick: ({ detail }) => {
            switch (detail.id) {
              case "profile":
                router.push("/settings/users");
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
