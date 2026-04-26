"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getCameroonCities } from "@/lib/cameroon-cities";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";

const schema = z.object({
  name: z.string().min(2, "Minimum 2 caractères"),
  city: z.string().min(2, "Sélectionnez une ville"),
});

type FormData = z.infer<typeof schema>;

export default function AgenciesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: agencies, isLoading } = useQuery({
    queryKey: ["agencies"],
    queryFn: () => axios.get("/api/agencies").then((r) => r.data.data),
  });

  const deleteAgency = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/agencies/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agencies"] }); toast.success("Agence supprimée"); },
    onError: (e) => {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : "Erreur";
      toast.error(msg ?? "Impossible de supprimer cette agence");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agences</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="gap-1.5"><Plus className="h-4 w-4" />Nouvelle agence</Button>} />
          <CreateAgencyDialog
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["agencies"] });
              qc.invalidateQueries({ queryKey: ["agencies-status"] });
              setCreateOpen(false);
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Utilisateurs</TableHead>
              <TableHead>Incidents</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agencies?.map((agency: {
              id: string; name: string; city: string;
              _count: { users: number; incidents: number };
            }) => (
              <TableRow key={agency.id}>
                <TableCell className="font-medium">{agency.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{agency.city}</Badge>
                </TableCell>
                <TableCell>{agency._count.users}</TableCell>
                <TableCell>{agency._count.incidents}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <EditAgencyButton agency={agency} />
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="destructive" size="sm">Supprimer</Button>} />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer {agency.name} ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. Impossible si des utilisateurs ou incidents y sont liés.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteAgency.mutate(agency.id)}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function EditAgencyButton({ agency }: { agency: { id: string; name: string; city: string } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const cities = useMemo(() => getCameroonCities(), []);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: agency.name, city: agency.city },
  });

  const selectedCity = watch("city");

  const onSubmit = async (data: FormData) => {
    try {
      await axios.patch(`/api/agencies/${agency.id}`, data);
      toast.success("Agence mise à jour");
      qc.invalidateQueries({ queryKey: ["agencies"] });
      qc.invalidateQueries({ queryKey: ["agencies-status"] });
      setOpen(false);
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : "Erreur";
      toast.error(msg ?? "Erreur lors de la mise à jour");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset({ name: agency.name, city: agency.city });
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Modifier</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;agence</DialogTitle>
          <DialogDescription>Cameroun — sélectionnez la ville de l&apos;agence.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Input placeholder="Nom de l'agence" {...register("name")} />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Select
              value={selectedCity}
              onValueChange={(v) => {
                if (v !== null) setValue("city", v as string, { shouldValidate: true });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une ville" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateAgencyDialog({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const cities = useMemo(() => getCameroonCities(), []);
  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await axios.post("/api/agencies", data);
      toast.success("Agence créée");
      reset();
      onSuccess();
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : "Erreur";
      toast.error(msg ?? "Erreur lors de la création");
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Nouvelle agence</DialogTitle>
        <DialogDescription>Cameroun — sélectionnez la ville de l&apos;agence.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Input placeholder="Nom de l'agence (ex: Agence Akwa)" {...register("name")} />
          {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <Select onValueChange={(v) => {
            if (v !== null) setValue("city", v as string, { shouldValidate: true });
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une ville du Cameroun" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {cities.map((city) => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city.message}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Annuler</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Création..." : "Créer"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
