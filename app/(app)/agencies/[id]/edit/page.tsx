"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getCameroonCities } from "@/lib/cameroon-cities";
import axios from "axios";
import toast from "react-hot-toast";

const schema = z.object({
  name: z.string().min(2, "Minimum 2 caractères"),
  city: z.string().min(2, "Sélectionnez une ville"),
});

type FormData = z.infer<typeof schema>;

export default function EditAgencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [selectedCity, setSelectedCity] = useState("");
  const cities = useMemo(() => getCameroonCities(), []);

  const { data: agency, isLoading } = useQuery({
    queryKey: ["agency", id],
    queryFn: () => axios.get(`/api/agencies/${id}`).then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (agency) {
      reset({ name: agency.name, city: agency.city });
      setSelectedCity(agency.city);
      setReady(true);
    }
  }, [agency, reset]);

  const update = useMutation({
    mutationFn: (data: FormData) => axios.patch(`/api/agencies/${id}`, data),
    onSuccess: () => { toast.success("Agence mise à jour"); router.push("/agencies"); },
    onError: () => toast.error("Erreur"),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Modifier l&apos;agence</CardTitle>
          <p className="text-sm text-muted-foreground">Cameroun — villes disponibles uniquement</p>
        </CardHeader>
        <CardContent>
          {ready && (
            <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-4">
              <div>
                <Input placeholder="Nom de l'agence" {...register("name")} />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Select
                  value={selectedCity}
                  onValueChange={(v) => {
                    if (v !== null) {
                      setSelectedCity(v);
                      setValue("city", v, { shouldValidate: true });
                    }
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
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()}>Annuler</Button>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
