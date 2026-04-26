"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

const STATUS_INFO = {
  operational:   { label: "Opérationnel",  icon: CheckCircle,    color: "text-green-600",  bg: "bg-green-50",  dot: "bg-green-500" },
  degraded:      { label: "Dégradé",        icon: AlertTriangle,  color: "text-orange-600", bg: "bg-orange-50", dot: "bg-orange-500" },
  major_outage:  { label: "Panne majeure",  icon: XCircle,        color: "text-red-600",    bg: "bg-red-50",    dot: "bg-red-500 animate-pulse" },
};

function getAgencyStatus(incidents: { priority: string; status: string }[]) {
  if (incidents.some((i) => i.priority === "CRITICAL")) return "major_outage";
  if (incidents.some((i) => i.priority === "HIGH")) return "degraded";
  if (incidents.length > 0) return "degraded";
  return "operational";
}

export default function StatusPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["public-status"],
    queryFn: () => axios.get("/api/public/status").then((r) => r.data),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const allOperational = data?.agencies?.every(
    (a: { incidents: { priority: string; status: string }[] }) =>
      getAgencyStatus(a.incidents) === "operational"
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-2">
            ETS MARCEL RECORDZ
          </p>
          <h1 className="text-3xl font-bold text-gray-900">Page de statut des services</h1>
          {data?.updatedAt && (
            <p className="text-sm text-gray-500 mt-2">
              Mis à jour le {new Date(data.updatedAt).toLocaleString("fr-FR")}
            </p>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Actualisation..." : "Actualiser"}
          </button>
        </div>

        {/* Statut global */}
        {!isLoading && (
          <div className={`flex items-center gap-3 rounded-xl p-5 mb-8 ${allOperational ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
            <span className={`h-3 w-3 rounded-full ${allOperational ? "bg-green-500" : "bg-orange-500 animate-pulse"}`} />
            <div>
              <p className={`font-semibold ${allOperational ? "text-green-700" : "text-orange-700"}`}>
                {allOperational ? "Tous les services sont opérationnels" : "Certains services sont impactés"}
              </p>
              <p className="text-sm text-gray-500">
                {data?.byStatus?.find((s: { status: string }) => s.status === "OPEN")?._count ?? 0} incident(s) ouvert(s) en ce moment
              </p>
            </div>
          </div>
        )}

        {/* Agences */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Agences</h2>
          {isLoading
            ? [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-200 animate-pulse" />)
            : data?.agencies?.map((agency: {
                id: string; name: string; city: string;
                incidents: { priority: string; status: string }[];
              }) => {
                const statusKey = getAgencyStatus(agency.incidents);
                const { label, icon: Icon, color, bg, dot } = STATUS_INFO[statusKey];
                return (
                  <div key={agency.id} className={`flex items-center justify-between rounded-xl border px-5 py-4 ${bg}`}>
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                      <div>
                        <p className="font-medium text-gray-800">{agency.name}</p>
                        <p className="text-xs text-gray-500">{agency.city}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-sm font-medium ${color}`}>
                      <Icon className="h-4 w-4" />
                      {label}
                      {agency.incidents.length > 0 && (
                        <span className="ml-2 rounded-full bg-white/60 px-2 py-0.5 text-xs">
                          {agency.incidents.length} incident(s)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-12">
          Cette page est publique et se rafraîchit toutes les 60 secondes.
        </p>
      </div>
    </div>
  );
}
