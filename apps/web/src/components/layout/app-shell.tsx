"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Server, AlertTriangle, Network, Globe,
  FileText, Settings, Bell, Moon, Sun, LogOut,
  ChevronLeft, ChevronRight, Menu, User, Users, Brain,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuthStore, useNotificationStore, useSiteStore } from "@/stores";
import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const navSections = [
  {
    label: "Monitor",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/devices", label: "Devices", icon: Server },
      { href: "/incidents", label: "Incidents", icon: AlertTriangle },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/topology", label: "Topology", icon: Network },
      { href: "/maps", label: "Geo Map", icon: Globe },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/users", label: "Users", icon: Users },
      { href: "/ai", label: "AI Analysis", icon: Brain },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const allNavItems = navSections.flatMap((s) => s.items);

function SidebarNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { siteName, logoUrl } = useSiteStore();

  return (
    <aside className={cn(
      "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out relative",
      collapsed ? "w-16" : "w-56"
    )}>
      {/* Subtle right-edge glow line */}
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />

      {/* Logo area */}
      <div className="flex h-12 items-center border-b border-sidebar-border px-3 gap-2">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden group">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-7 w-7 shrink-0 rounded-md object-cover ring-1 ring-sidebar-border" />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono text-xs font-bold shadow-sm shadow-primary/25">
              {siteName.charAt(0).toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <span className="font-semibold text-sm text-sidebar-foreground truncate group-hover:text-primary transition-colors">
              {siteName}
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        {navSections.map((section, idx) => (
          <div key={section.label} className={cn("mb-1", idx > 0 && "mt-2")}>
            {/* Section label with divider */}
            {!collapsed ? (
              <div className="flex items-center gap-2 px-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {section.label}
                </span>
                <div className="flex-1 h-px bg-sidebar-border/60" />
              </div>
            ) : (
              idx > 0 && <div className="mx-2 mb-2 h-px bg-sidebar-border/60" />
            )}

            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const link = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group/item relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-all duration-150",
                      isActive
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    {/* Active left indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary shadow-sm shadow-primary/40" />
                    )}
                    <item.icon className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover/item:text-sidebar-foreground"
                    )} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger className="w-full">{link}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return link;
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>
    </aside>
  );
}

function MobileSidebar() {
  const pathname = usePathname();
  const { siteName, logoUrl } = useSiteStore();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="md:hidden p-1.5 hover:bg-accent rounded-md transition-colors" onClick={() => setOpen(true)}>
        <Menu className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/60 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border shadow-2xl shadow-black/30 animate-in slide-in-from-left duration-300 ease-out">
            {/* Logo */}
            <div className="flex h-12 items-center border-b border-sidebar-border px-3">
              <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
                {logoUrl ? (
                  <img src={logoUrl} alt={siteName} className="h-7 w-7 rounded-md object-cover ring-1 ring-sidebar-border" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono text-xs font-bold shadow-sm shadow-primary/25">
                    {siteName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-semibold text-sm text-sidebar-foreground">{siteName}</span>
              </Link>
            </div>

            {/* Nav */}
            <div className="py-3 px-2 overflow-y-auto flex-1">
              {navSections.map((section, idx) => (
                <div key={section.label} className={cn("mb-1", idx > 0 && "mt-2")}>
                  <div className="flex items-center gap-2 px-2 mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      {section.label}
                    </span>
                    <div className="flex-1 h-px bg-sidebar-border/60" />
                  </div>
                  <nav className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-all duration-150",
                            isActive
                              ? "bg-primary/15 text-primary font-medium"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary shadow-sm shadow-primary/40" />
                          )}
                          <item.icon className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground"
                          )} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore();
  const { siteName, logoUrl, loaded, load } = useSiteStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { if (!loaded) load(); }, [loaded, load]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarNav collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="relative flex h-12 items-center justify-between border-b border-border px-4 bg-card/50 backdrop-blur-sm">
          {/* Bottom glow line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

          <MobileSidebar />

          <div className="flex items-center gap-1 ml-auto">
            {/* Theme toggle */}
            <button
              className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors overflow-hidden"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className={cn(
                "h-4 w-4 transition-all duration-300",
                theme === "dark" ? "rotate-0 scale-100" : "rotate-90 scale-0 absolute inset-0 m-auto"
              )} />
              <Moon className={cn(
                "h-4 w-4 transition-all duration-300",
                theme === "dark" ? "-rotate-90 scale-0 absolute inset-0 m-auto" : "rotate-0 scale-100"
              )} />
            </button>

            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground animate-in zoom-in-50 duration-200">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0 border-border/60 shadow-xl shadow-black/10">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-medium text-primary">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors">
                      Mark all read
                    </button>
                  )}
                </div>
                <ScrollArea className="h-64">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Bell className="h-5 w-5 mb-1.5 opacity-40" />
                      <span className="text-xs">No notifications</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {notifications.slice(0, 20).map((n) => {
                        const severityDot: Record<string, string> = {
                          critical: "bg-red-500 shadow-red-500/40",
                          high: "bg-orange-500 shadow-orange-500/40",
                          medium: "bg-amber-500 shadow-amber-500/40",
                          low: "bg-blue-500 shadow-blue-500/40",
                        };
                        return (
                          <div
                            key={n.id}
                            className={cn(
                              "group px-3 py-2.5 text-xs hover:bg-accent/50 transition-colors cursor-pointer",
                              !n.read && "bg-primary/5"
                            )}
                            onClick={() => markRead(n.id)}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "h-2 w-2 rounded-full shrink-0 shadow-sm",
                                severityDot[n.severity] || "bg-muted-foreground"
                              )} />
                              <span className="font-medium truncate">{n.title}</span>
                              {!n.read && (
                                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <div className="text-muted-foreground mt-0.5 ml-4 truncate">{n.message}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
                <div className="border-t border-border/60 px-3 py-2">
                  <Link href="/incidents" className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
                    View all incidents
                  </Link>
                </div>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="mx-1.5 h-5 bg-border/60" />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent transition-colors outline-none group">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20 group-hover:ring-primary/50 transition-all">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="text-[13px] hidden lg:inline text-foreground/80 group-hover:text-foreground transition-colors">
                  {user?.name || "User"}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 border-border/60 shadow-xl shadow-black/10">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal py-2">
                    <div className="text-[13px] font-semibold">{user?.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{user?.email}</div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2 w-full text-[13px] cursor-pointer">
                    <Settings className="h-3.5 w-3.5" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-3.5 w-3.5" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
