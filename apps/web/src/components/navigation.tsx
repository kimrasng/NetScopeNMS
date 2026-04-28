"use client";

import SideNavigation, { type SideNavigationProps } from "@cloudscape-design/components/side-navigation";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSite } from "@/lib/site";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { siteName } = useSite();

  const navItems: SideNavigationProps["items"] = [
    {
      type: "section",
      text: t("nav.monitoring"),
      items: [
        { type: "link", text: t("nav.dashboard"), href: "/dashboard" },
        { type: "link", text: t("nav.devices"), href: "/devices" },
        { type: "link", text: t("nav.incidents"), href: "/incidents" },
        { type: "link", text: t("nav.topology"), href: "/topology" },
      ],
    },
    {
      type: "section",
      text: t("nav.network"),
      items: [
        { type: "link", text: t("nav.metrics"), href: "/metrics" },
        { type: "link", text: t("nav.maps"), href: "/maps" },
      ],
    },
    {
      type: "section",
      text: t("nav.operations"),
      items: [
        { type: "link", text: t("nav.alertRules"), href: "/alert-rules" },
        { type: "link", text: t("nav.notifications"), href: "/notifications" },
        { type: "link", text: t("nav.maintenance"), href: "/maintenance" },
        { type: "link", text: t("nav.configSnapshots"), href: "/config-snapshots" },
      ],
    },
    {
      type: "section",
      text: t("nav.intelligence"),
      items: [
        { type: "link", text: t("nav.ai"), href: "/ai" },
        { type: "link", text: t("nav.reports"), href: "/reports" },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: t("nav.administration"),
      items: [
        { type: "link", text: t("nav.users"), href: "/settings/users" },
        { type: "link", text: t("nav.siteSettings"), href: "/settings/site" },
        { type: "link", text: t("nav.apiKeys"), href: "/settings/api-keys" },
        { type: "link", text: t("nav.auditLogs"), href: "/settings/audit-logs" },
        { type: "link", text: t("nav.dashboards"), href: "/dashboards" },
        { type: "link", text: t("nav.profile"), href: "/settings/profile" },
        { type: "link", text: t("nav.preferences"), href: "/settings/preferences" },
      ],
    },
  ];

  return (
    <SideNavigation
      header={{ href: "/dashboard", text: siteName }}
      activeHref={pathname}
      items={navItems}
      onFollow={(event) => {
        event.preventDefault();
        router.push(event.detail.href);
      }}
    />
  );
}
