"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import { SlaBadge } from "@/components/sla-badge";

const COLUMNS = [
  { id: "OPEN",        label: "Ouvert",   accent: "border-t-red-500",    bg: "bg-red-50/40" },
  { id: "IN_PROGRESS", label: "En cours", accent: "border-t-yellow-500", bg: "bg-yellow-50/40" },
  { id: "RESOLVED",    label: "Résolu",   accent: "border-t-green-500",  bg: "bg-green-50/40" },
  { id: "CLOSED",      label: "Fermé",    accent: "border-t-gray-400",   bg: "bg-gray-50/40" },
];

const PRIORITY_COLOR: Record<string, string> = {
  LOW:      "bg-gray-100 text-gray-600",
  MEDIUM:   "bg-blue-100 text-blue-700",
  HIGH:     "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

type Incident = {
  id: string; title: string; status: string; priority: string;
  slaDeadline?: string | null; slaBreached: boolean;
  creator: { name: string }; agency: { name: string; city: string };
};

/* ── Carte draggable ── */
function Card({ incident, ghost = false }: { incident: Incident; ghost?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: incident.id,
    data: { incident },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={[
        "rounded-lg border bg-white p-3 shadow-sm select-none",
        ghost ? "opacity-40 cursor-grabbing" : "cursor-grab hover:shadow-md active:cursor-grabbing",
        isDragging ? "z-50" : "",
      ].join(" ")}
    >
      <Link
        href={`/incidents/${incident.id}`}
        className="text-sm font-medium hover:underline line-clamp-2 block"
        onClick={(e) => { if (isDragging) e.preventDefault(); }}
      >
        {incident.title}
      </Link>
      <p className="text-xs text-muted-foreground mt-1 truncate">
        {incident.agency.name} · {incident.creator.name}
      </p>
      <div className="flex flex-wrap items-center gap-1 mt-2">
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_COLOR[incident.priority]}`}>
          {incident.priority}
        </span>
        <SlaBadge deadline={incident.slaDeadline ?? null} breached={incident.slaBreached} />
      </div>
    </div>
  );
}

/* ── Colonne droppable ── */
function Column({
  col, incidents, isOver,
}: {
  col: typeof COLUMNS[number];
  incidents: Incident[];
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: col.id });

  return (
    <div className={`flex flex-col rounded-xl border-t-4 transition-colors ${col.accent} ${isOver ? col.bg : "bg-gray-50"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-white rounded-t-xl">
        <span className="text-sm font-semibold">{col.label}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums">
          {incidents.length}
        </span>
      </div>

      {/* Drop zone — prend toute la hauteur disponible */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] transition-colors rounded-b-xl ${
          isOver ? "ring-2 ring-inset ring-black/10" : ""
        }`}
      >
        {incidents.map((inc) => (
          <Card key={inc.id} incident={inc} />
        ))}
        {incidents.length === 0 && !isOver && (
          <p className="text-center text-xs text-muted-foreground py-10">Aucun incident</p>
        )}
        {isOver && (
          <div className="h-16 rounded-lg border-2 border-dashed border-black/20 bg-black/5" />
        )}
      </div>
    </div>
  );
}

/* ── Page principale ── */
export default function KanbanPage() {
  const qc = useQueryClient();
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // Optimistic local state
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data } = useQuery({
    queryKey: ["incidents-kanban"],
    queryFn: () =>
      axios.get("/api/incidents", { params: { limit: 200 } }).then((r) => r.data.data as Incident[]),
  });

  const incidents: Incident[] = (data ?? []).map((i) => ({
    ...i,
    status: localStatus[i.id] ?? i.status,
  }));

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      axios.patch(`/api/incidents/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents-kanban"] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["agencies-status"] });
      qc.invalidateQueries({ queryKey: ["public-status"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setLocalStatus({});
    },
    onError: (_, vars) => {
      toast.error("Erreur lors du déplacement");
      setLocalStatus((prev) => { const n = { ...prev }; delete n[vars.id]; return n; });
    },
  });

  const getCol = (colId: string) => incidents.filter((i) => i.status === colId);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveIncident(incidents.find((i) => i.id === active.id) ?? null);
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    const colId = COLUMNS.find((c) => c.id === over?.id)?.id ?? null;
    setOverColumnId(colId);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveIncident(null);
    setOverColumnId(null);

    if (!over) return;
    const targetColId = COLUMNS.find((c) => c.id === over.id)?.id;
    if (!targetColId) return;

    const incident = incidents.find((i) => i.id === active.id);
    if (!incident || incident.status === targetColId) return;

    // Optimistic update — carte se déplace immédiatement
    setLocalStatus((prev) => ({ ...prev, [incident.id]: targetColId }));
    updateStatus.mutate({ id: incident.id, status: targetColId });
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-88px)]">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold">Vue Kanban</h1>
        <Link href="/incidents" className="text-sm text-muted-foreground underline">
          Vue tableau
        </Link>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-3 flex-1 min-h-0">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              col={col}
              incidents={getCol(col.id)}
              isOver={overColumnId === col.id}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
          {activeIncident && (
            <div className="w-56 rotate-2 opacity-95 shadow-2xl">
              <Card incident={activeIncident} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
