"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { formatDate } from "@/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MapPin, Users, AlertTriangle, ArrowLeft } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "destructive",
  IN_PROGRESS: "default",
  RESOLVED: "secondary",
  CLOSED: "outline",
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export default function AgencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [statusFilter, setStatusFilter] = useState("");

  const { data: agency, isLoading: loadingAgency } = useQuery({
    queryKey: ["agency", id],
    queryFn: () => axios.get(`/api/agencies/${id}`).then((r) => r.data.data),
  });

  const { data: incidentsData, isLoading: loadingIncidents } = useQuery({
    queryKey: ["incidents", { agencyId: id, status: statusFilter }],
    queryFn: () =>
      axios.get("/api/incidents", {
        params: { agencyId: id, status: statusFilter || undefined, limit: 50 },
      }).then((r) => r.data),
  });

  const incidents = incidentsData?.data ?? [];
  const total = incidentsData?.meta?.total ?? 0;

  const countByStatus = incidents.reduce((acc: Record<string, number>, inc: { status: string }) => {
    acc[inc.status] = (acc[inc.status] ?? 0) + 1;
    return acc;
  }, {});

  if (loadingAgency) return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>;
  if (!agency) return <p>Agence introuvable</p>;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/agencies/status">
          <Button variant="outline" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{agency.name}</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <MapPin className="h-3.5 w-3.5" /> {agency.city}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Total incidents</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Ouverts</p>
            <p className="text-2xl font-bold text-red-500">{countByStatus["OPEN"] ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">En cours</p>
            <p className="text-2xl font-bold text-yellow-500">{countByStatus["IN_PROGRESS"] ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Utilisateurs</p>
                <p className="text-2xl font-bold">{agency._count?.users ?? agency.users?.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incidents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Incidents de l&apos;agence</CardTitle>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "ALL" || v === null ? "" : v)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              <SelectItem value="OPEN">Ouverts</SelectItem>
              <SelectItem value="IN_PROGRESS">En cours</SelectItem>
              <SelectItem value="RESOLVED">Résolus</SelectItem>
              <SelectItem value="CLOSED">Fermés</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loadingIncidents ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>
          ) : incidents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Aucun incident trouvé</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Signalé par</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((inc: {
                  id: string; title: string; status: string; priority: string;
                  creator: { name: string }; createdAt: string;
                }) => (
                  <TableRow key={inc.id}>
                    <TableCell className="font-medium max-w-xs truncate">{inc.title}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inc.status]}>{inc.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLOR[inc.priority]}`}>
                        {inc.priority}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{inc.creator.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(inc.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/incidents/${inc.id}`}>
                        <Button variant="outline" size="sm">Détails</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Utilisateurs de l'agence */}
      {agency.users?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Membres de l&apos;agence</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {agency.users.map((u: { id: string; name: string; role: string }) => (
                <div key={u.id} className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">{u.role}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
