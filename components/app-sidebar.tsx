"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  AlertTriangle,
  Building2,
  Users,
  ChevronRight,
  LogOut,
  Settings,
  Kanban,
  Clock,
  Globe,
  Bell,
  MessageSquare,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type SubItem = { title: string; href: string };
type NavItem = { title: string; icon: React.ElementType; href: string; sub?: SubItem[] };

const navMain: { label: string; items: NavItem[] }[] = [
  {
    label: "Vue générale",
    items: [{ title: "Tableau de bord", icon: LayoutDashboard, href: "/dashboard" }],
  },
  {
    label: "Incidents",
    items: [
      {
        title: "Incidents",
        icon: AlertTriangle,
        href: "/incidents",
        sub: [
          { title: "Tous les incidents", href: "/incidents" },
          { title: "Vue Kanban", href: "/incidents/kanban" },
          { title: "Créer un incident", href: "/incidents/create" },
        ],
      },
    ],
  },
  {
    label: "Organisation",
    items: [
      {
        title: "Agences",
        icon: Building2,
        href: "/agencies",
        sub: [
          { title: "Création d'une agence", href: "/agencies" },
          { title: "Statut des agences", href: "/agencies/status" },
        ],
      },
    ],
  },
];

function NavCollapsibleItem({
  item,
  pathname,
  role,
}: {
  item: NavItem & { sub: SubItem[] };
  pathname: string;
  role: string | undefined;
}) {
  const isActive = item.sub.some((s) => pathname.startsWith(s.href));
  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const visibleSubs = item.sub.filter((sub) => {
    if (sub.href === "/incidents/kanban" && role !== "ADMIN" && role !== "SUPPORT") return false;
    if (sub.href === "/incidents/create" && role !== "USER") return false;
    return true;
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              isActive={pathname.startsWith(item.href)}
              className="flex items-center gap-2"
            />
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-sm">{item.title}</span>
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {visibleSubs.map((sub) => (
              <SidebarMenuSubItem key={sub.href}>
                <SidebarMenuSubButton
                  render={<Link href={sub.href} />}
                  isActive={pathname === sub.href}
                >
                  <span className="text-sm">{sub.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const isAdminOrSupport = isAdmin || session?.user.role === "SUPPORT";
  const [signOutOpen, setSignOutOpen] = useState(false);

  const { data: unreadMessages } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: () => axios.get("/api/conversations/unread").then((r) => r.data.data.total as number),
    refetchInterval: 10000,
    enabled: !!session,
  });

  const { data: unreadNotifs } = useQuery({
    queryKey: ["unread-notifications"],
    queryFn: () => axios.get("/api/notifications?unread=true").then((r) => r.data.data.unread as number),
    refetchInterval: 10000,
    enabled: !!session,
  });

  const { data: myAgency } = useQuery({
    queryKey: ["my-agency"],
    queryFn: () => axios.get("/api/me/agency").then((r) => r.data.data),
    enabled: !!session && session.user.role === "USER",
  });

  return (
    <Sidebar
      className="border-r-0"
      style={{ "--sidebar-width": "240px" } as React.CSSProperties}
    >
      {/* ── Header ── */}
      <SidebarHeader className="p-2">
        <Link
          href="/dashboard"
          className="flex h-10 items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-black text-white text-xs font-bold">
            IP
          </div>
          <span className="font-bold text-sm leading-none">Incident Portal</span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      {/* ── Navigation ── */}
      <SidebarContent className="px-2 py-2">
        {navMain
          .filter((group) => {
            // Masquer "Organisation" (Agences) pour les USER
            if (group.label === "Organisation" && !isAdminOrSupport) return false;
            return true;
          })
          .map((group) => (
          <SidebarGroup key={group.label} className="px-0 py-1">
            <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) =>
                item.sub ? (
                  <NavCollapsibleItem
                    key={item.title}
                    item={item as NavItem & { sub: SubItem[] }}
                    pathname={pathname}
                    role={session?.user.role}
                  />
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/")
                      }
                      className="flex items-center gap-2"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        {/* Communication */}
        <SidebarGroup className="px-0 py-1">
          <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground">
            Communication
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/notifications" />} isActive={pathname === "/notifications"} className="flex items-center gap-2">
                <Bell className="h-4 w-4 shrink-0" />
                <span className="text-sm">Notifications</span>
                {(unreadNotifs ?? 0) > 0 && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {(unreadNotifs ?? 0) > 9 ? "9+" : unreadNotifs}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/messages" />} isActive={pathname === "/messages"} className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="text-sm">Messages</span>
                {(unreadMessages ?? 0) > 0 && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {(unreadMessages ?? 0) > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Admin */}
        {isAdminOrSupport && (
          <SidebarGroup className="px-0 py-1">
            <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground">
              Administration
            </SidebarGroupLabel>
            <SidebarMenu>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/admin/users" />} isActive={pathname === "/admin/users"} className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0" />
                    <span className="text-sm">Utilisateurs</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/admin/sla" />} isActive={pathname === "/admin/sla"} className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span className="text-sm">Configuration SLA</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/status" target="_blank" />} className="flex items-center gap-2">
                  <Globe className="h-4 w-4 shrink-0" />
                  <span className="text-sm">Page statut public</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Carte rapide — réservée aux USER (Admin et Support n'ont pas le droit de créer) */}
        {session?.user.role === "USER" && (
          <div className="mx-2 mt-4 rounded-lg border border-sidebar-border bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold">Créer un incident</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Signalez rapidement un problème à votre agence.
            </p>
            <Link
              href="/incidents/create"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-black py-1.5 text-xs font-medium text-white transition-colors hover:bg-black/80"
            >
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              Nouveau incident
            </Link>
          </div>
        )}
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="p-2">
        <SidebarSeparator className="mb-2" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent transition-colors" />
            }
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-black text-white text-xs">
                {session?.user.name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium leading-none">
                {session?.user.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {session?.user.email}
              </span>
              {myAgency && (
                <span className="truncate text-xs text-muted-foreground font-medium">
                  {myAgency.name} — {myAgency.city}
                </span>
              )}
            </div>
            <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              session?.user.role === "ADMIN"
                ? "bg-black text-white"
                : session?.user.role === "SUPPORT"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
            }`}>
              {session?.user.role}
            </span>
            <Settings className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem render={<Link href="/profile" />}>
              Profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-500"
              onClick={() => setSignOutOpen(true)}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      {/* ── Confirmation déconnexion ── */}
      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer la déconnexion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            Êtes-vous sûr de vouloir vous déconnecter ?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSignOutOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Se déconnecter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
