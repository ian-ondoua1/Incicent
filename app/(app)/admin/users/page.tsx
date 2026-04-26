"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { formatDate } from "@/lib/format-date";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import toast from "react-hot-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";

const ROLE_STYLES: Record<string, string> = {
  ADMIN:   "bg-black text-white",
  SUPPORT: "bg-blue-100 text-blue-700",
  USER:    "bg-gray-100 text-gray-600",
};

const schema = z.object({
  name:     z.string().min(2, "Minimum 2 caractères"),
  email:    z.string().email("Email invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
  role:     z.enum(["USER", "SUPPORT", "ADMIN"]),
  agencyId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const isAdmin = session?.user.role === "ADMIN";

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => axios.get("/api/users").then((r) => r.data.data),
    enabled: isAdmin,
  });

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: () => axios.get("/api/agencies").then((r) => r.data.data),
    enabled: isAdmin,
  });

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "USER" },
  });

  const createUser = useMutation({
    mutationFn: (data: FormData) => axios.post("/api/users", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Utilisateur créé");
      setOpen(false);
      reset();
    },
    onError: (e) => {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : "Erreur";
      toast.error(msg ?? "Erreur lors de la création");
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      axios.patch(`/api/users/${id}/role`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Rôle mis à jour"); },
    onError: () => toast.error("Erreur"),
  });

  const updateAgency = useMutation({
    mutationFn: ({ id, agencyId }: { id: string; agencyId: string | null }) =>
      axios.patch(`/api/users/${id}/agency`, { agencyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Agence mise à jour"); },
    onError: () => toast.error("Erreur"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users?.length ?? 0} utilisateur(s) enregistré(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Nouvel utilisateur
            </Button>
          } />
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Créer un utilisateur</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Renseignez les informations ci-dessous. L&apos;utilisateur recevra ses identifiants par email.
              </p>
            </DialogHeader>
            <form onSubmit={handleSubmit((d) => createUser.mutate(d))} className="mt-4 space-y-5">
              {/* Identité */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Identité</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom complet</label>
                    <Input placeholder="Ex : Jean Mbarga" {...register("name")} />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Email professionnel</label>
                    <Input placeholder="prenom.nom@marcelrecordz.cm" type="email" {...register("email")} />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                  </div>
                </div>
              </div>

              {/* Accès */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Accès & permissions</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Mot de passe initial</label>
                    <Input placeholder="Min. 6 caractères" type="password" {...register("password")} />
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Rôle</label>
                    <Select defaultValue="USER" onValueChange={(v) => setValue("role", v as FormData["role"])}>
                      <SelectTrigger><SelectValue placeholder="Rôle" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">USER — Utilisateur standard</SelectItem>
                        <SelectItem value="SUPPORT">SUPPORT — Agent de support</SelectItem>
                        <SelectItem value="ADMIN">ADMIN — Administrateur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Rattachement */}
              {agencies?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Rattachement</p>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Agence (optionnel)</label>
                    <Select onValueChange={(v) => setValue("agencyId", v === "none" ? undefined : (v as string))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner une agence" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune agence</SelectItem>
                        {agencies.map((a: { id: string; name: string; city: string }) => (
                          <SelectItem key={a.id} value={a.id}>{a.name} — {a.city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={createUser.isPending}>
                  {createUser.isPending ? "Création..." : "Créer l'utilisateur"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Agence</TableHead>
              <TableHead>Inscrit le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user: {
              id: string; name: string; email: string; role: string; createdAt: string;
              agency?: { name: string; city: string };
            }) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Select value={user.role} onValueChange={(role) => role && updateRole.mutate({ id: user.id, role })}>
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_STYLES[user.role]}`}>
                          {user.role}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">USER</SelectItem>
                      <SelectItem value="SUPPORT">SUPPORT</SelectItem>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={user.agency?.name ? agencies?.find((a: { id: string; name: string }) => a.name === user.agency?.name)?.id ?? "none" : "none"}
                    onValueChange={(v) => updateAgency.mutate({ id: user.id, agencyId: v === "none" ? null : v })}
                  >
                    <SelectTrigger className="w-48 h-7 text-xs">
                      <SelectValue>
                        {user.agency
                          ? <span>{user.agency.name} — {user.agency.city}</span>
                          : <span className="text-muted-foreground">Aucune agence</span>}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune agence</SelectItem>
                      {agencies?.map((a: { id: string; name: string; city: string }) => (
                        <SelectItem key={a.id} value={a.id}>{a.name} — {a.city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
