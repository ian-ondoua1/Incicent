"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import axios from "axios";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle, RefreshCw, CheckCheck, ArrowRight,
  Bell, GitPullRequest, ShieldAlert, MessageSquare,
} from "lucide-react";

type Notif = {
  id: string; type: string; title: string; message: string;
  read: boolean; createdAt: string; incidentId?: string | null;
};

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  INCIDENT_CREATED: { label: "Nouvel incident",   icon: AlertTriangle,  color: "text-red-600",    bg: "bg-red-50" },
  STATUS_CHANGED:   { label: "Statut modifié",    icon: GitPullRequest, color: "text-blue-600",   bg: "bg-blue-50" },
  ASSIGNED:         { label: "Assignation",        icon: Bell,           color: "text-purple-600", bg: "bg-purple-50" },
  SLA_BREACH:       { label: "SLA dépassé",        icon: ShieldAlert,    color: "text-orange-600", bg: "bg-orange-50" },
  COMMENT_ADDED:    { label: "Commentaire",         icon: MessageSquare,  color: "text-green-600",  bg: "bg-green-50" },
};

function formatDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    + " à "
    + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function NotifItem({ notif, onRead }: { notif: Notif; onRead: (id: string) => void }) {
  const meta = TYPE_META[notif.type] ?? TYPE_META.INCIDENT_CREATED;
  const Icon = meta.icon;

  return (
    <div
      className={`flex gap-3 rounded-xl border p-4 transition-colors ${
        notif.read ? "bg-white" : "bg-blue-50/40 border-blue-100"
      }`}
    >
      {/* Icône type */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
        <Icon className={`h-4 w-4 ${meta.color}`} />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
            {!notif.read && (
              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 align-middle" />
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{formatDate(notif.createdAt)}</span>
        </div>
        <p className="mt-1.5 text-sm font-medium text-foreground">{notif.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
        {notif.incidentId && (
          <Link
            href={`/incidents/${notif.incidentId}`}
            onClick={() => onRead(notif.id)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            Voir l&apos;incident <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");

  const typeFilter = tab === "all" ? undefined : tab.toUpperCase();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notifications-page", tab],
    queryFn: () => axios.get("/api/notifications", {
      params: { type: typeFilter, limit: 50 },
    }).then((r) => r.data.data),
    enabled: !!session,
  });

  const notifications: Notif[] = data?.notifications ?? [];
  const unread: number = data?.unread ?? 0;

  const markAllRead = useMutation({
    mutationFn: () => axios.patch("/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-page"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markOneRead = async (id: string) => {
    await axios.patch(`/api/notifications/${id}/read`).catch(() => {});
    qc.invalidateQueries({ queryKey: ["notifications-page"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const tabs = [
    { key: "all",              label: "Toutes" },
    { key: "incident_created", label: "Nouveaux incidents" },
    { key: "status_changed",   label: "Statuts" },
    { key: "sla_breach",       label: "SLA" },
    { key: "comment_added",    label: "Commentaires" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unread > 0 ? `${unread} non lue(s)` : "Tout est lu"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />Actualiser
          </Button>
          {unread > 0 && (
            <Button size="sm" className="gap-1.5" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              <CheckCheck className="h-3.5 w-3.5" />Tout marquer lu
            </Button>
          )}
        </div>
      </div>

      {/* Tabs par type */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4 space-y-3">
            {isLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)
            ) : notifications.length === 0 ? (
              <div className="rounded-xl border border-dashed p-12 text-center">
                <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Aucune notification</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <NotifItem key={notif.id} notif={notif} onRead={markOneRead} />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
