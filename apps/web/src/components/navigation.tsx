"use client";

import SideNavigation, { type SideNavigationProps } from "@cloudscape-design/components/side-navigation";
import Badge from "@cloudscape-design/components/badge";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS: SideNavigationProps["items"] = [
  {
    type: "section",
    text: "Monitoring",
    items: [
      { type: "link", text: "Dashboard", href: "/dashboard" },
      { type: "link", text: "Devices", href: "/devices" },
      { type: "link", text: "Incidents", href: "/incidents" },
      { type: "link", text: "Topology", href: "/topology" },
    ],
  },
  {
    type: "section",
    text: "Network",
    items: [
      { type: "link", text: "Metrics", href: "/metrics" },
      { type: "link", text: "Maps", href: "/maps" },
    ],
  },
  {
    type: "section",
    text: "Operations",
    items: [
      { type: "link", text: "Alert Rules", href: "/alert-rules" },
      { type: "link", text: "Notifications", href: "/notifications" },
      { type: "link", text: "Maintenance", href: "/maintenance" },
      { type: "link", text: "Config Snapshots", href: "/config-snapshots" },
    ],
  },
  {
    type: "section",
    text: "Intelligence",
    items: [
      { type: "link", text: "AI Assistant", href: "/ai" },
      { type: "link", text: "Reports", href: "/reports" },
    ],
  },
  { type: "divider" },
  {
    type: "section",
    text: "Administration",
    items: [
      { type: "link", text: "Users", href: "/settings/users" },
      { type: "link", text: "Site Settings", href: "/settings/site" },
      { type: "link", text: "API Keys", href: "/settings/api-keys" },
      { type: "link", text: "Audit Logs", href: "/settings/audit-logs" },
      { type: "link", text: "Dashboards", href: "/dashboards" },
    ],
  },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SideNavigation
      header={{ href: "/dashboard", text: "NetPulse" }}
      activeHref={pathname}
      items={NAV_ITEMS}
      onFollow={(event) => {
        event.preventDefault();
        router.push(event.detail.href);
      }}
    />
  );
}
