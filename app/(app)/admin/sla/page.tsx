"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, AlertTriangle, Shield, Zap } from "lucide-react";

const PRIORITY_META = [
  { key: "LOW",      label: "Basse",    color: "text-gray-500",  bg: "bg-gray-50",   icon: Clock,         desc: "Incidents mineurs, pas d'urgence" },
  { key: "MEDIUM",   label: "Moyenne",  color: "text-blue-600",  bg: "bg-blue-50",   icon: Shield,        desc: "Impact limité sur les opérations" },
  { key: "HIGH",     label: "Haute",    color: "text-orange-600",bg: "bg-orange-50", icon: AlertTriangle, desc: "Impact significatif, intervention rapide" },
  { key: "CRITICAL", label: "Critique", color: "text-red-600",   bg: "bg-red-50",    icon: Zap,           desc: "Système critique hors service" },
];

type SlaEntry = { priority: string; responseTime: number; resolutionTime: number };

function minutesToDisplay(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function SlaConfigPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [configs, setConfigs] = useState<Record<string, { responseTime: number; resolutionTime: number }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["sla-config"],
    queryFn: () => axios.get("/api/sla").then((r) => r.data.data as SlaEntry[]),
    enabled: session?.user.role === "ADMIN",
  });

  useEffect(() => {
    if (data) {
      const map: Record<string, { responseTime: number; resolutionTime: number }> = {};
      data.forEach((d) => { map[d.priority] = { responseTime: d.responseTime, resolutionTime: d.resolutionTime }; });
      setConfigs(map);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => axios.post("/api/sla", PRIORITY_META.map((p) => ({
      priority: p.key,
      responseTime: configs[p.key]?.responseTime ?? 60,
      resolutionTime: configs[p.key]?.resolutionTime ?? 480,
    }))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sla-config"] }); toast.success("Configuration SLA sauvegardée"); },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const update = (priority: string, field: "responseTime" | "resolutionTime", value: number) => {
    setConfigs((prev) => ({ ...prev, [priority]: { ...prev[priority], [field]: value } }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configuration SLA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Définissez les délais de réponse et de résolution par niveau de priorité. Ces délais déclenchent des alertes automatiques.
        </p>
      </div>

      <div className="grid gap-4">
        {PRIORITY_META.map(({ key, label, color, bg, icon: Icon, desc }) => {
          const cfg = configs[key] ?? { responseTime: 60, resolutionTime: 480 };
          return (
            <Card key={key} className={`border-l-4 ${key === "CRITICAL" ? "border-l-red-500" : key === "HIGH" ? "border-l-orange-500" : key === "MEDIUM" ? "border-l-blue-500" : "border-l-gray-400"}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div>
                    <CardTitle className={`text-base ${color}`}>Priorité {label}</CardTitle>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium">Délai de première réponse</label>
                    <p className="text-xs text-muted-foreground mb-2">En combien de minutes un agent doit répondre</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={cfg.responseTime}
                        onChange={(e) => update(key, "responseTime", Number(e.target.value))}
                        className="w-28 h-8 text-sm"
                      />
                      <span className="text-sm text-muted-foreground">min</span>
                      <span className="text-xs text-muted-foreground">({minutesToDisplay(cfg.responseTime)})</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Délai de résolution</label>
                    <p className="text-xs text-muted-foreground mb-2">Temps maximum pour résoudre l&apos;incident</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={cfg.resolutionTime}
                        onChange={(e) => update(key, "resolutionTime", Number(e.target.value))}
                        className="w-28 h-8 text-sm"
                      />
                      <span className="text-sm text-muted-foreground">min</span>
                      <span className="text-xs text-muted-foreground">({minutesToDisplay(cfg.resolutionTime)})</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Valeurs par défaut recommandées */}
      <Card className="bg-gray-50 border-dashed">
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-2">Valeurs recommandées (référence)</p>
          <div className="grid grid-cols-4 gap-4 text-xs text-muted-foreground">
            <div><p className="font-semibold text-gray-600">BASSE</p><p>Réponse : 8h</p><p>Résolution : 48h</p></div>
            <div><p className="font-semibold text-blue-600">MOYENNE</p><p>Réponse : 4h</p><p>Résolution : 24h</p></div>
            <div><p className="font-semibold text-orange-600">HAUTE</p><p>Réponse : 1h</p><p>Résolution : 8h</p></div>
            <div><p className="font-semibold text-red-600">CRITIQUE</p><p>Réponse : 15min</p><p>Résolution : 2h</p></div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 text-xs"
            onClick={() => setConfigs({
              LOW:      { responseTime: 480,  resolutionTime: 2880 },
              MEDIUM:   { responseTime: 240,  resolutionTime: 1440 },
              HIGH:     { responseTime: 60,   resolutionTime: 480  },
              CRITICAL: { responseTime: 15,   resolutionTime: 120  },
            })}
          >
            Appliquer les valeurs recommandées
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading} className="px-8">
          {save.isPending ? "Sauvegarde..." : "Sauvegarder la configuration"}
        </Button>
      </div>
    </div>
  );
}
