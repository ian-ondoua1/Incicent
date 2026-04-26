"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Building2,
  MapPin,
  Users,
  AlertTriangle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Search,
  ArrowRight,
} from "lucide-react";

type AgencyStatus = {
  id: string;
  name: string;
  city: string;
  usersCount: number;
  incidentsTotal: number;
  open: number;
  inProgress: number;
  resolved: number;
  slaBreached: number;
  health: "healthy" | "warning" | "critical";
};

const HEALTH_META: Record<AgencyStatus["health"], { label: string; dot: string; ring: string; text: string; bg: string }> = {
  healthy:  { label: "En bonne santé", dot: "bg-emerald-500", ring: "ring-emerald-500/20", text: "text-emerald-700", bg: "bg-emerald-50" },
  warning:  { label: "À surveiller",   dot: "bg-amber-500",   ring: "ring-amber-500/20",   text: "text-amber-700",   bg: "bg-amber-50"  },
  critical: { label: "Critique",       dot: "bg-red-500",     ring: "ring-red-500/20",     text: "text-red-700",     bg: "bg-red-50"    },
};

export default function AgenciesStatusPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | AgencyStatus["health"]>("all");

  const { data: agencies, isLoading } = useQuery<AgencyStatus[]>({
    queryKey: ["agencies-status"],
    queryFn: () => axios.get("/api/agencies/status").then((r) => r.data.data),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const stats = useMemo(() => {
    if (!agencies) return { total: 0, healthy: 0, warning: 0, critical: 0 };
    return {
      total: agencies.length,
      healthy: agencies.filter((a) => a.health === "healthy").length,
      warning: agencies.filter((a) => a.health === "warning").length,
      critical: agencies.filter((a) => a.health === "critical").length,
    };
  }, [agencies]);

  const filtered = useMemo(() => {
    if (!agencies) return [];
    const q = search.trim().toLowerCase();
    return agencies.filter((a) => {
      const matchesSearch =
        q.length === 0 ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q);
      const matchesFilter = filter === "all" || a.health === filter;
      return matchesSearch && matchesFilter;
    });
  }, [agencies, search, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Statut des agences</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d'ensemble de la santé opérationnelle de chaque agence.
          </p>
        </div>
      </div>

      {/* Résumé global */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile icon={<Building2 className="h-4 w-4 text-muted-foreground" />} label="Total agences" value={stats.total} />
        <SummaryTile icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="En bonne santé" value={stats.healthy} accent="text-emerald-600" />
        <SummaryTile icon={<Clock className="h-4 w-4 text-amber-500" />} label="À surveiller" value={stats.warning} accent="text-amber-600" />
        <SummaryTile icon={<ShieldAlert className="h-4 w-4 text-red-500" />} label="Critiques" value={stats.critical} accent="text-red-600" />
      </div>

      {/* Recherche + filtre */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou ville…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
          {(["all", "healthy", "warning", "critical"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {key === "all" ? "Toutes" : HEALTH_META[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Grille de cartes */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground">
              {agencies?.length === 0
                ? "Aucune agence enregistrée pour le moment."
                : "Aucune agence ne correspond à votre recherche."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => <AgencyCard key={a.id} agency={a} />)}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p className={`text-2xl font-bold mt-1 ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function AgencyCard({ agency }: { agency: AgencyStatus }) {
  const meta = HEALTH_META[agency.health];
  const resolutionRate = agency.incidentsTotal === 0
    ? null
    : Math.round((agency.resolved / agency.incidentsTotal) * 100);

  return (
    <Link
      href={`/agencies/${agency.id}`}
      className="group block"
    >
      <Card className={`h-full transition-all hover:shadow-md hover:-translate-y-0.5 ring-1 ${meta.ring}`}>
        <CardContent className="p-5 space-y-4">
          {/* Header carte */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base leading-tight truncate">{agency.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{agency.city}</span>
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text} shrink-0`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<Users className="h-3.5 w-3.5" />} label="Users" value={agency.usersCount} />
            <Stat icon={<AlertTriangle className="h-3.5 w-3.5 text-red-500" />} label="Ouverts" value={agency.open} valueClass={agency.open > 0 ? "text-red-600" : undefined} />
            <Stat icon={<Clock className="h-3.5 w-3.5 text-amber-500" />} label="En cours" value={agency.inProgress} />
          </div>

          {/* SLA + taux résolution */}
          <div className="flex items-center justify-between text-xs pt-2 border-t">
            {agency.slaBreached > 0 ? (
              <span className="flex items-center gap-1.5 text-red-600 font-medium">
                <ShieldAlert className="h-3.5 w-3.5" />
                {agency.slaBreached} SLA dépassé{agency.slaBreached > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                SLA respectés
              </span>
            )}
            {resolutionRate !== null && (
              <span className="text-muted-foreground">
                {resolutionRate}% résolus
              </span>
            )}
          </div>

          {/* Call to action */}
          <div className="flex items-center justify-end text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Voir le détail
            <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Stat({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: number; valueClass?: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-lg font-bold leading-tight mt-0.5 ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}
