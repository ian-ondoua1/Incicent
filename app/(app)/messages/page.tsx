"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { formatDate } from "@/lib/format-date";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Plus, AlertTriangle, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";

const ROLE_COLORS: Record<string, string> = {
  ADMIN:   "bg-black text-white",
  SUPPORT: "bg-blue-100 text-blue-700",
  USER:    "bg-gray-100 text-gray-600",
};

type Participant = { id: string; name: string; role: string; agency?: { name: string; city?: string } | null };
type ConvParticipant = { id: string; userId: string; user: Participant };
type Message = { id: string; content: string; createdAt: string; senderId: string; sender: Participant };
type Conversation = {
  id: string; subject?: string | null; incidentId?: string | null;
  updatedAt: string; unread: number;
  participants: ConvParticipant[];
  messages: (Message & { sender: Participant })[];
};

function getOtherParticipants(conv: Conversation, myId: string): Participant[] {
  return conv.participants.filter((p) => p.userId !== myId).map((p) => p.user);
}

function ConvName(conv: Conversation, myId: string): string {
  if (conv.subject) return conv.subject;
  return getOtherParticipants(conv, myId).map((p) => p.name).join(", ") || "Conversation";
}

type Incident = { id: string; title: string; creator: { id: string; name: string } };

/* ── Nouvelle conversation ── */
function NewConversationDialog({ onCreated }: { onCreated: (convId: string) => void }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [incidentId, setIncidentId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const qc = useQueryClient();

  const { data: recipients = [] } = useQuery({
    queryKey: ["chat-recipients"],
    queryFn: () => axios.get("/api/conversations/recipients").then((r) => r.data.data as Participant[]),
    enabled: open,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents-list"],
    queryFn: () =>
      axios.get("/api/incidents", { params: { limit: 100 } }).then(
        (r) => r.data.data as Incident[]
      ),
    enabled: open && session?.user.role !== "USER",
  });

  const handleIncidentChange = (val: string | null) => {
    if (!val || val === "none") {
      setIncidentId("");
      return;
    }
    setIncidentId(val);
    // Auto-populate recipient with ticket creator when available
    const incident = incidents.find((i) => i.id === val);
    if (incident?.creator?.id) {
      const creatorInList = recipients.find((r) => r.id === incident.creator.id);
      if (creatorInList) setRecipientId(incident.creator.id);
    }
  };

  const reset = () => {
    setRecipientId(""); setIncidentId(""); setSubject(""); setMessage("");
  };

  const create = useMutation({
    mutationFn: () => axios.post("/api/conversations", {
      recipientId, subject: subject || undefined,
      incidentId: incidentId || undefined, firstMessage: message,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setOpen(false);
      reset();
      onCreated(res.data.data.id);
    },
    onError: (e) => {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : "Erreur";
      toast.error(msg ?? "Erreur");
    },
  });

  const selectedRecipient = recipients.find((r) => r.id === recipientId);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger
        render={
          <button className="inline-flex items-center gap-1 rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80 transition-colors" />
        }
      >
        <Plus className="h-4 w-4" />
        Nouveau
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nouvelle conversation</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">

          {/* Lier à un ticket — affiché seulement pour SUPPORT/ADMIN */}
          {session?.user.role !== "USER" && (
            <Select value={incidentId || "none"} onValueChange={handleIncidentChange}>
              <SelectTrigger><SelectValue placeholder="Lier à un ticket (optionnel)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun ticket</SelectItem>
                {incidents.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    #{i.title.slice(0, 40)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Destinataire */}
          <Select value={recipientId} onValueChange={(v) => setRecipientId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Destinataire *">
                {selectedRecipient
                  ? `${selectedRecipient.name} — ${selectedRecipient.role}`
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {recipients.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Aucun destinataire disponible</div>
              ) : (
                recipients.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                    {u.agency ? ` (${u.agency.name})` : ""}
                    {" — "}
                    <span className="text-xs text-muted-foreground">{u.role}</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Input placeholder="Sujet (optionnel)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea
            placeholder="Votre message *"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Annuler</Button>
            <Button disabled={!recipientId || !message.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Envoi..." : "Envoyer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Thread de messages ── */
function ChatThread({ convId, myId }: { convId: string; myId: string }) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", convId],
    queryFn: () => axios.get(`/api/conversations/${convId}/messages`).then((r) => r.data.data as Message[]),
    refetchInterval: 3000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Invalider conversations pour mettre à jour les non-lus
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["conversations"] });
    qc.invalidateQueries({ queryKey: ["unread-messages"] });
  }, [messages.length, qc]);

  const send = useMutation({
    mutationFn: () => axios.post(`/api/conversations/${convId}/messages`, { content: text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", convId] });
    },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) send.mutate(); }
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Chargement...</div>;

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.senderId === myId;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className={`text-xs ${isMe ? "bg-black text-white" : "bg-gray-200"}`}>
                  {msg.sender.name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className={`max-w-[72%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{msg.sender.name}</span>
                  <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${ROLE_COLORS[msg.sender.role]}`}>
                    {msg.sender.role}
                  </span>
                </div>
                <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  isMe ? "bg-black text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            placeholder="Écrire un message... (Entrée pour envoyer)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            className="resize-none text-sm"
          />
          <Button size="icon" disabled={!text.trim() || send.isPending} onClick={() => send.mutate()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

/* ── Page principale ── */
function MessagesContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("conv"));

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => axios.get("/api/conversations").then((r) => r.data.data as Conversation[]),
    refetchInterval: 5000,
  });

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-88px)] gap-0 rounded-xl border overflow-hidden">

      {/* ── Liste des conversations ── */}
      <div className="w-72 shrink-0 flex flex-col border-r bg-gray-50/50">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <h2 className="font-semibold text-sm">Messages</h2>
          </div>
          <NewConversationDialog onCreated={(id) => setSelectedId(id)} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-12">Aucune conversation</p>
          ) : conversations.map((conv) => {
            const others = getOtherParticipants(conv, session?.user.id ?? "");
            const lastMsg = conv.messages[0];
            const isSelected = conv.id === selectedId;
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-gray-100 transition-colors ${isSelected ? "bg-gray-100 border-l-2 border-l-black" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{ConvName(conv, session?.user.id ?? "")}</p>
                    {others.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {others.map((u) => u.name).join(", ")}
                      </p>
                    )}
                    {conv.incidentId && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="h-3 w-3 text-orange-500" />
                        <span className="text-[10px] text-orange-600 font-medium">Ticket lié</span>
                      </div>
                    )}
                    {lastMsg && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {lastMsg.sender.name}: {lastMsg.content}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(conv.updatedAt)}
                    </span>
                    {conv.unread > 0 && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Thread ── */}
      <div className="flex-1 flex flex-col bg-white">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-20" />
            <p className="text-sm">Sélectionnez une conversation</p>
          </div>
        ) : (
          <>
            {/* Header thread */}
            <div className="flex items-center gap-3 border-b px-4 py-3 bg-white">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{ConvName(selected, session?.user.id ?? "")}</p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {getOtherParticipants(selected, session?.user.id ?? "").map((p) => (
                    <span key={p.id} className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{p.name}</span>
                      <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${ROLE_COLORS[p.role]}`}>{p.role}</span>
                    </span>
                  ))}
                  {selected.incidentId && (
                    <Link href={`/incidents/${selected.incidentId}`} className="flex items-center gap-1 ml-2 text-xs text-orange-600 underline hover:text-orange-800">
                      <AlertTriangle className="h-3 w-3" />
                      Voir le ticket
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <ChatThread convId={selected.id} myId={session?.user.id ?? ""} />
          </>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}
