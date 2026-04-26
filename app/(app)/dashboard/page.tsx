"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import axios from "axios";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle, CheckCircle, Clock, Building2, ShieldAlert,
  Users, MapPin, Plus, TrendingUp,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#ef4444", IN_PROGRESS: "#f59e0b", RESOLVED: "#22c55e", CLOSED: "#6b7280",
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Ouverts", IN_PROGRESS: "En cours", RESOLVED: "Résolus", CLOSED: "Fermés",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#6b7280", MEDIUM: "#3b82f6", HIGH: "#f59e0b", CRITICAL: "#ef4444",
};

function formatMttr(minutes: number | null): string {
  if (minutes === null) return "N/A";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

type RecentIncident = {
  id: string; title: string; status: string; priority: string;
  creator: { name: string }; agency: { name: string } | null;
};

type DashboardData = {
  role: "USER" | "SUPPORT" | "ADMIN";
  myAgency: { id: string; name: string; city: string } | null;
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  recent: RecentIncident[];
  mttr: number | null;
  byAgency: { name: string; city: string; count: number }[];
  slaBreached: number;
  usersByRole: Record<string, number>;
  agenciesCount: number;
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = session?.user.role;

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard-stats"],
    queryFn: () => axios.get("/api/dashboard/stats").then((r) => r.data.data),
    refetchInterval: 60000,
  });

  if (isLoading || !data) return <DashboardSkeleton />;

  if (role === "ADMIN")   return <AdminDashboard data={data} userName={session?.user.name ?? ""} />;
  if (role === "SUPPORT") return <SupportDashboard data={data} userName={session?.user.name ?? ""} />;
  return <UserDashboard data={data} userName={session?.user.name ?? ""} />;
}

/* ─────────────────── USER ─────────────────── */
function UserDashboard({ data, userName }: { data: DashboardData; userName: string }) {
  const statusData = Object.entries(data.byStatus).map(([name, value]) => ({
    name: STATUS_LABEL[name] ?? name, key: name, value,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Bonjour, {userName.split(" ")[0]}</h1>
          {data.myAgency ? (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {data.myAgency.name} — {data.myAgency.city}
            </p>
          ) : (
            <p className="text-sm text-orange-600 mt-1">Aucune agence assignée — contactez l&apos;administrateur</p>
          )}
        </div>
        <Link
          href="/incidents/create"
          className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Signaler un incident
        </Link>
      </div>

      {!data.myAgency ? null : (
        <>
          {/* KPIs simples */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />} label="Total signalés" value={data.total} />
            <Kpi icon={<Clock className="h-4 w-4 text-red-500" />} label="Ouverts" value={data.byStatus.OPEN ?? 0} highlight={(data.byStatus.OPEN ?? 0) > 0 ? "text-red-500" : undefined} />
            <Kpi icon={<TrendingUp className="h-4 w-4 text-amber-500" />} label="En cours" value={data.byStatus.IN_PROGRESS ?? 0} />
            <Kpi icon={<CheckCircle className="h-4 w-4 text-green-500" />} label="Résolus" value={(data.byStatus.RESOLVED ?? 0) + (data.byStatus.CLOSED ?? 0)} highlight="text-green-600" />
          </div>

          {data.total > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Répartition des incidents</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {statusData.map((e) => <Cell key={e.key} fill={STATUS_COLORS[e.key] ?? "#8884d8"} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <RecentIncidentsCard recent={data.recent} hideAgency />
            </div>
          )}

          {data.total === 0 && (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                <p className="text-sm text-muted-foreground">Aucun incident signalé pour votre agence.</p>
                <Link href="/incidents/create" className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 transition-colors">
                  <Plus className="h-4 w-4" />
                  Créer le premier
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────── SUPPORT ─────────────────── */
function SupportDashboard({ data, userName }: { data: DashboardData; userName: string }) {
  const statusData = Object.entries(data.byStatus).map(([name, value]) => ({
    name: STATUS_LABEL[name] ?? name, key: name, value,
  }));
  const priorityData = Object.entries(data.byPriority).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vue d&apos;ensemble opérationnelle</h1>
        <p className="text-sm text-muted-foreground mt-1">Bonjour {userName.split(" ")[0]} — tous les tickets en cours</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />} label="Total" value={data.total} subtitle={`${data.byStatus.OPEN ?? 0} ouvert(s)`} />
        <Kpi icon={<Clock className="h-4 w-4 text-blue-500" />} label="MTTR moyen" value={formatMttr(data.mttr)} subtitle="Temps moyen de résolution" isString />
        <Kpi icon={<ShieldAlert className="h-4 w-4 text-red-500" />} label="SLA dépassés" value={data.slaBreached} subtitle="À traiter en priorité" highlight={data.slaBreached > 0 ? "text-red-500" : "text-green-600"} />
        <Kpi icon={<CheckCircle className="h-4 w-4 text-green-500" />} label="Résolus" value={(data.byStatus.RESOLVED ?? 0) + (data.byStatus.CLOSED ?? 0)} highlight="text-green-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Répartition par statut</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.map((e) => <Cell key={e.key} fill={STATUS_COLORS[e.key] ?? "#8884d8"} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Répartition par priorité</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData} barSize={36}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {priorityData.map((e) => <Cell key={e.name} fill={PRIORITY_COLORS[e.name] ?? "#8884d8"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {data.byAgency.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Incidents par agence</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, data.byAgency.length * 32)}>
              <BarChart data={data.byAgency} layout="vertical" barSize={20}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="count" fill="#0a0a0a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <RecentIncidentsCard recent={data.recent} />
    </div>
  );
}

/* ─────────────────── ADMIN ─────────────────── */
function AdminDashboard({ data, userName }: { data: DashboardData; userName: string }) {
  const statusData = Object.entries(data.byStatus).map(([name, value]) => ({
    name: STATUS_LABEL[name] ?? name, key: name, value,
  }));
  const priorityData = Object.entries(data.byPriority).map(([name, value]) => ({ name, value }));
  const totalUsers = Object.values(data.usersByRole).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">Bonjour {userName.split(" ")[0]} — vue globale du système</p>
      </div>

      {/* Row 1 : KPIs incidents */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />} label="Total incidents" value={data.total} subtitle={`${data.byStatus.OPEN ?? 0} ouvert(s)`} />
        <Kpi icon={<Clock className="h-4 w-4 text-blue-500" />} label="MTTR moyen" value={formatMttr(data.mttr)} isString subtitle="Temps de résolution" />
        <Kpi icon={<ShieldAlert className="h-4 w-4 text-red-500" />} label="SLA dépassés" value={data.slaBreached} highlight={data.slaBreached > 0 ? "text-red-500" : "text-green-600"} subtitle="En cours non résolus" />
        <Kpi icon={<CheckCircle className="h-4 w-4 text-green-500" />} label="Résolus" value={(data.byStatus.RESOLVED ?? 0) + (data.byStatus.CLOSED ?? 0)} highlight="text-green-600" subtitle="Résolus + fermés" />
      </div>

      {/* Row 2 : KPIs système */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi icon={<Users className="h-4 w-4 text-indigo-500" />} label="Utilisateurs" value={totalUsers} subtitle={`${data.usersByRole.USER ?? 0} users · ${data.usersByRole.SUPPORT ?? 0} support · ${data.usersByRole.ADMIN ?? 0} admin`} />
        <Kpi icon={<Building2 className="h-4 w-4 text-purple-500" />} label="Agences" value={data.agenciesCount} subtitle="Actives" />
        <Kpi icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} label="Taux de résolution" value={data.total === 0 ? "0%" : `${Math.round(((data.byStatus.RESOLVED ?? 0) + (data.byStatus.CLOSED ?? 0)) / data.total * 100)}%`} isString subtitle={`${data.total} incidents`} />
      </div>

      {/* Graphiques */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Répartition par statut</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.map((e) => <Cell key={e.key} fill={STATUS_COLORS[e.key] ?? "#8884d8"} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Répartition par priorité</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData} barSize={36}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {priorityData.map((e) => <Cell key={e.name} fill={PRIORITY_COLORS[e.name] ?? "#8884d8"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {data.byAgency.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Top agences (par volume d&apos;incidents)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, data.byAgency.length * 32)}>
              <BarChart data={data.byAgency} layout="vertical" barSize={20}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#0a0a0a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <RecentIncidentsCard recent={data.recent} />
    </div>
  );
}

/* ─────────────────── Sous-composants ─────────────────── */
function Kpi({ icon, label, value, subtitle, highlight, isString }: {
  icon: React.ReactNode; label: string; value: number | string; subtitle?: string;
  highlight?: string; isString?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p className={`text-3xl font-bold ${highlight ?? ""}`}>{isString ? value : value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function RecentIncidentsCard({ recent, hideAgency }: { recent: RecentIncident[]; hideAgency?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Incidents récents</CardTitle>
          <Link href="/incidents" className="text-xs text-muted-foreground underline">Voir tout</Link>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun incident récent</p>
        ) : (
          <div className="space-y-2">
            {recent.map((inc) => (
              <Link key={inc.id} href={`/incidents/${inc.id}`} className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{inc.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {inc.creator.name}{!hideAgency && inc.agency ? ` — ${inc.agency.name}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{inc.priority}</Badge>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: STATUS_COLORS[inc.status] }}>
                    {STATUS_LABEL[inc.status] ?? inc.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i=><Skeleton key={i} className="h-28"/>)}</div>
      <div className="grid md:grid-cols-2 gap-4">{[1,2].map(i=><Skeleton key={i} className="h-64"/>)}</div>
    </div>
  );
}
