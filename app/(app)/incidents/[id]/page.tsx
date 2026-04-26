"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SlaBadge } from "@/components/sla-badge";
import { formatDate } from "@/lib/format-date";
import { MessageSquare } from "lucide-react";
import toast from "react-hot-toast";

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: () => axios.get(`/api/incidents/${id}`).then((r) => r.data.data),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => axios.patch(`/api/incidents/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incident", id] }); toast.success("Statut mis à jour"); },
    onError: () => toast.error("Erreur"),
  });

  const addComment = useMutation({
    mutationFn: () => axios.post(`/api/incidents/${id}/comments`, { content: comment }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incident", id] }); setComment(""); toast.success("Commentaire ajouté"); },
    onError: () => toast.error("Erreur"),
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  if (!incident) return <p>Incident introuvable</p>;

  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "SUPPORT";

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* Bouton retour */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour aux incidents
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{incident.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Créé par {incident.creator.name} le {formatDate(incident.createdAt)}
          </p>
          {incident.agency && (
            <p className="text-sm font-medium mt-1">
              Agence : {incident.agency.name} — {incident.agency.city}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Badge variant="outline">{incident.priority}</Badge>
            <Badge>{incident.status}</Badge>
          </div>
          <SlaBadge deadline={incident.slaDeadline ?? null} breached={incident.slaBreached} />
          {session?.user.role !== "USER" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={async () => {
                try {
                  const res = await axios.post("/api/conversations", {
                    recipientId: incident.creator.id,
                    subject: `Incident : ${incident.title}`,
                    incidentId: id,
                    firstMessage: `Bonjour, je vous contacte concernant l'incident "${incident.title}".`,
                  });
                  router.push(`/messages?conv=${res.data.data.id}`);
                } catch {
                  toast.error("Erreur lors de l'ouverture de la discussion");
                }
              }}
            >
              <MessageSquare className="h-4 w-4" />
              Discuter
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="whitespace-pre-wrap">{incident.description}</p>
          {incident.category && <p className="text-sm text-muted-foreground">Catégorie : {incident.category}</p>}
        </CardContent>
      </Card>

      {incident.attachments?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Pièces jointes ({incident.attachments.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {incident.attachments.map((att: { id: string; url: string; filename: string; mimeType: string; size: number }) => (
              <div key={att.id} className="rounded-lg border overflow-hidden">
                {att.mimeType.startsWith("image/") ? (
                  <a href={att.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="max-h-72 w-full object-contain bg-gray-50"
                    />
                  </a>
                ) : (
                  <video
                    src={att.url}
                    controls
                    className="w-full max-h-72 bg-black"
                  />
                )}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 text-xs text-muted-foreground">
                  <span className="truncate font-medium">{att.filename}</span>
                  <span className="ml-4 shrink-0">{(att.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <Card>
          <CardHeader><CardTitle>Changer le statut</CardTitle></CardHeader>
          <CardContent>
            <Select value={incident.status} onValueChange={(v) => { if (v !== null) updateStatus.mutate(v); }}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Ouvert</SelectItem>
                <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                <SelectItem value="RESOLVED">Résolu</SelectItem>
                <SelectItem value="CLOSED">Fermé</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Commentaires ({incident.comments.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {incident.comments.map((c: { id: string; author: { name: string }; content: string; createdAt: string }) => (
            <div key={c.id} className="border rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{c.author.name}</span>
                <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
              </div>
              <p className="text-sm">{c.content}</p>
            </div>
          ))}
          <Separator />
          <Textarea
            placeholder="Ajouter un commentaire..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <Button size="sm" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>
            {addComment.isPending ? "Envoi..." : "Commenter"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {incident.auditLogs.map((log: { id: string; action: string; oldValue?: string; newValue?: string; user: { name: string }; createdAt: string }) => (
              <div key={log.id} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                <span className="font-medium">{log.user.name}</span>
                <span>{log.action}</span>
                {log.oldValue && <span className="text-muted-foreground">{log.oldValue} → {log.newValue}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
