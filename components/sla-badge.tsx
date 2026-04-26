"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

function getTimeLeft(deadline: string): { text: string; urgent: boolean; breached: boolean } {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { text: "SLA dépassé", urgent: true, breached: true };
  const totalMin = Math.floor(diff / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const urgent = diff < 30 * 60 * 1000; // moins de 30 min
  const text = h > 0 ? `${h}h ${m}min` : `${m}min`;
  return { text, urgent, breached: false };
}

export function SlaBadge({ deadline, breached }: { deadline: string | null; breached: boolean }) {
  const [info, setInfo] = useState(() =>
    deadline ? getTimeLeft(deadline) : null
  );

  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => setInfo(getTimeLeft(deadline)), 30000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline || !info) return null;

  if (breached || info.breached) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        <AlertTriangle className="h-3 w-3" />
        SLA dépassé
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
      info.urgent ? "bg-orange-100 text-orange-700 animate-pulse" : "bg-green-100 text-green-700"
    }`}>
      <Clock className="h-3 w-3" />
      {info.text}
    </span>
  );
}
