"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import axios from "axios";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { SlaBadge } from "@/components/sla-badge";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/export";
import { Download, FileSpreadsheet, FileText, Kanban, Plus, Clock, CheckCircle, AlertTriangle, Circle } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import toast from "react-hot-toast";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "destructive", IN_PROGRESS: "default", RESOLVED: "secondary", CLOSED: "outline",
};

type Incident = {
  id: string; title: string; status: string; priority: string;
  creator: { name: string }; agency: { name: string; city: string };
  createdAt: string; resolvedAt?: string | null;
  slaDeadline?: string | null; slaBreached: boolean; category?: string | null;
};

export default function IncidentsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const isPrivileged = isAdmin || session?.user.role === "SUPPORT";

  if (!session) return null;
  if (!isPrivileged) return <UserIncidentsView />;
  return <ManagerIncidentsView isAdmin={isAdmin} />;
}

/* ══════════════════════════════════════════
   VUE USER — Mes incidents d'agence
══════════════════════════════════════════ */
function UserIncidentsView() {
  const [status, setStatus] = useState("");

  const { data: agency } = useQuery({
    queryKey: ["my-agency"],
    queryFn: () => axios.get("/api/me/agency").then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["my-incidents", status],
    queryFn: () => axios.get("/api/incidents", {
      params: { status: status || undefined, limit: 50 },
    }).then((r) => r.data),
  });

  const incidents: Incident[] = data?.data ?? [];

  const byStatus = {
    OPEN:        incidents.filter((i) => i.status === "OPEN").length,
    IN_PROGRESS: incidents.filter((i) => i.status === "IN_PROGRESS").length,
    RESOLVED:    incidents.filter((i) => i.status === "RESOLVED").length,
    CLOSED:      incidents.filter((i) => i.status === "CLOSED").length,
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* En-tête agence */}
      {agency && (
        <div className="rounded-xl border bg-white p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Mon agence</p>
            <h1 className="text-xl font-bold mt-0.5">{agency.name}</h1>
            <p className="text-sm text-muted-foreground">{agency.city}</p>
          </div>
          <Link href="/incidents/create">
            <Button className="gap-1.5"><Plus className="h-4 w-4" />Signaler un incident</Button>
          </Link>
        </div>
      )}

      {/* KPIs rapides */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Ouverts",   value: byStatus.OPEN,        icon: Circle,        color: "text-red-500" },
          { label: "En cours",  value: byStatus.IN_PROGRESS, icon: Clock,         color: "text-yellow-500" },
          { label: "Résolus",   value: byStatus.RESOLVED,    icon: CheckCircle,   color: "text-green-500" },
          { label: "Fermés",    value: byStatus.CLOSED,      icon: AlertTriangle, color: "text-gray-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setStatus(label === "Ouverts" ? "OPEN" : label === "En cours" ? "IN_PROGRESS" : label === "Résolus" ? "RESOLVED" : "CLOSED")}>
            <CardContent className="pt-4 pb-3">
              <Icon className={`h-5 w-5 ${color} mb-1`} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtre statut + liste */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold flex-1">
            {status ? `Incidents — ${status.replace("_", " ")}` : "Tous les incidents"}
          </h2>
          <Select value={status} onValueChange={(v) => setStatus(v === "ALL" || v === null ? "" : v)}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Filtrer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              <SelectItem value="OPEN">Ouverts</SelectItem>
              <SelectItem value="IN_PROGRESS">En cours</SelectItem>
              <SelectItem value="RESOLVED">Résolus</SelectItem>
              <SelectItem value="CLOSED">Fermés</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading
          ? [1,2,3].map((i) => <Skeleton key={i} className="h-20" />)
          : incidents.length === 0
          ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="text-muted-foreground text-sm">Aucun incident pour le moment</p>
              <Link href="/incidents/create" className="mt-3 inline-block text-sm underline">
                Signaler un incident
              </Link>
            </div>
          )
          : incidents.map((inc) => (
            <Link key={inc.id} href={`/incidents/${inc.id}`}>
              <div className="flex items-center gap-4 rounded-xl border bg-white p-4 hover:shadow-sm transition-shadow cursor-pointer">
                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  inc.status === "OPEN" ? "bg-red-500" :
                  inc.status === "IN_PROGRESS" ? "bg-yellow-500 animate-pulse" :
                  inc.status === "RESOLVED" ? "bg-green-500" : "bg-gray-300"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{inc.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(inc.createdAt)}
                    {inc.category && ` · ${inc.category}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    inc.priority === "CRITICAL" ? "bg-red-100 text-red-700" :
                    inc.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                    inc.priority === "MEDIUM" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}>{inc.priority}</span>
                  <Badge variant={STATUS_VARIANT[inc.status]} className="text-xs">{inc.status.replace("_", " ")}</Badge>
                  <SlaBadge deadline={inc.slaDeadline ?? null} breached={inc.slaBreached} />
                </div>
              </div>
            </Link>
          ))
        }
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   VUE SUPPORT/ADMIN — Gestion complète
══════════════════════════════════════════ */
function ManagerIncidentsView({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const isPrivileged = true;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reset = () => { setPage(1); setSelected(new Set()); };

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: () => axios.get("/api/agencies").then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["incidents", search, status, priority, agencyId, page],
    queryFn: () => axios.get("/api/incidents", {
      params: { search: search || undefined, status: status || undefined, priority: priority || undefined, agencyId: agencyId || undefined, page },
    }).then((r) => r.data),
  });

  const incidents: Incident[] = data?.data ?? [];

  const bulkAction = useMutation({
    mutationFn: (payload: { action: string; value?: string }) =>
      axios.post("/api/incidents/bulk", { ids: [...selected], ...payload }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      toast.success(`${selected.size} incident(s) ${vars.action === "delete" ? "supprimé(s)" : "mis à jour"}`);
      setSelected(new Set());
    },
    onError: () => toast.error("Erreur"),
  });

  const toggleAll = () => {
    if (selected.size === incidents.length) setSelected(new Set());
    else setSelected(new Set(incidents.map((i) => i.id)));
  };

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <div className="flex gap-2">
          <Link href="/incidents/kanban">
            <Button variant="outline" size="sm" className="gap-1"><Kanban className="h-4 w-4" />Kanban</Button>
          </Link>
          {isAdmin && <Link href="/incidents/create"><Button>Nouveau incident</Button></Link>}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Rechercher..." value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} className="max-w-xs" />
        <Select value={status} onValueChange={(v) => { setStatus(v === "ALL" || v === null ? "" : v); reset(); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous statuts</SelectItem>
            <SelectItem value="OPEN">Ouvert</SelectItem>
            <SelectItem value="IN_PROGRESS">En cours</SelectItem>
            <SelectItem value="RESOLVED">Résolu</SelectItem>
            <SelectItem value="CLOSED">Fermé</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v === "ALL" || v === null ? "" : v); reset(); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Priorité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes priorités</SelectItem>
            <SelectItem value="LOW">Basse</SelectItem>
            <SelectItem value="MEDIUM">Moyenne</SelectItem>
            <SelectItem value="HIGH">Haute</SelectItem>
            <SelectItem value="CRITICAL">Critique</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agencyId} onValueChange={(v) => { setAgencyId(v === "ALL" || v === null ? "" : v); reset(); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Agence" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes agences</SelectItem>
            {agencies?.map((a: { id: string; name: string; city: string }) => (
              <SelectItem key={a.id} value={a.id}>{a.name} — {a.city}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Export */}
        <div className="flex gap-1 ml-auto">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => exportToCSV(incidents)}>
            <Download className="h-3.5 w-3.5" />CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => exportToExcel(incidents)}>
            <FileSpreadsheet className="h-3.5 w-3.5" />Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => exportToPDF(incidents)}>
            <FileText className="h-3.5 w-3.5" />PDF
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && isPrivileged && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} sélectionné(s)</span>
          <Select onValueChange={(v) => bulkAction.mutate({ action: "status", value: (v as string | null) ?? undefined })}>
            <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Changer statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">→ Ouvert</SelectItem>
              <SelectItem value="IN_PROGRESS">→ En cours</SelectItem>
              <SelectItem value="RESOLVED">→ Résolu</SelectItem>
              <SelectItem value="CLOSED">→ Fermé</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => bulkAction.mutate({ action: "delete" })}>
              Supprimer
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => setSelected(new Set())}>
            Annuler
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {isPrivileged && (
                <TableHead className="w-10">
                  <input type="checkbox" checked={selected.size === incidents.length && incidents.length > 0} onChange={toggleAll} className="rounded" />
                </TableHead>
              )}
              <TableHead>Titre</TableHead>
              <TableHead>Agence</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Créé par</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((incident) => (
              <TableRow key={incident.id} className={selected.has(incident.id) ? "bg-muted/30" : ""}>
                {isPrivileged && (
                  <TableCell>
                    <input type="checkbox" checked={selected.has(incident.id)} onChange={() => toggle(incident.id)} className="rounded" />
                  </TableCell>
                )}
                <TableCell>
                  <Link href={`/incidents/${incident.id}`} className="font-medium hover:underline">{incident.title}</Link>
                </TableCell>
                <TableCell><Badge variant="secondary">{incident.agency.name} — {incident.agency.city}</Badge></TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[incident.status]}>{incident.status}</Badge></TableCell>
                <TableCell><Badge variant="outline">{incident.priority}</Badge></TableCell>
                <TableCell><SlaBadge deadline={incident.slaDeadline ?? null} breached={incident.slaBreached} /></TableCell>
                <TableCell>{incident.creator.name}</TableCell>
                <TableCell className="text-xs">{formatDate(incident.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data?.meta && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{data.meta.total} incident(s) — Page {data.meta.page}/{data.meta.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" size="sm" disabled={page >= data.meta.pages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}
    </div>
  );
}
