import type { AppLayoutProps } from "@cloudscape-design/components/app-layout";

const routes: Record<string, string> = {
  dashboard: "page.dashboard", devices: "page.devices", incidents: "page.incidents",
  topology: "page.topology", maps: "page.maps", metrics: "page.metrics",
  "alert-rules": "page.alertRules", notifications: "page.notifications", maintenance: "page.maintenance",
  "config-snapshots": "page.configSnapshots", ai: "page.ai", reports: "page.reports",
  dashboards: "page.dashboards", "device-groups": "Device groups", discovery: "Network discovery",
  users: "page.users", site: "page.siteSettings", "api-keys": "page.apiKeys",
  "audit-logs": "page.auditLogs", profile: "page.profile", preferences: "page.preferences",
};

export function consoleRoute(pathname: string, siteName: string, t: (key: string) => string) {
  const parts = pathname.split("/").filter(Boolean);
  const root = parts[0] === "settings" ? parts[1] : parts[0];
  const href = parts[0] === "settings" ? `/settings/${root}` : `/${root}`;
  const form = pathname.endsWith("/create") || pathname.endsWith("/edit") ||
    ["/settings/profile", "/settings/site", "/settings/preferences"].includes(pathname);
  const tables = ["devices", "incidents", "alert-rules", "maintenance", "config-snapshots", "reports", "dashboards", "api-keys", "audit-logs"];
  const contentType: AppLayoutProps.ContentType = form ? "form" :
    (root === "dashboard" || (root === "dashboards" && parts.length > 1)) ? "dashboard" :
    tables.includes(root) && pathname === href ? "table" : "default";
  const breadcrumbs = [{ text: siteName, href: "/dashboard" }, { text: t(routes[root] ?? root), href }];
  if (pathname !== href) {
    if (parts[1] !== "create" && parts[0] !== "settings") breadcrumbs.push({ text: t("Details"), href: `/${root}/${parts[1]}` });
    if (form) breadcrumbs.push({ text: t(pathname.endsWith("/edit") ? "common.edit" : "common.create"), href: pathname });
  }
  return { contentType, breadcrumbs, activeHref: href, form };
}
