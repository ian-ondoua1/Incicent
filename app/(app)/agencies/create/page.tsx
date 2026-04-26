"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCameroonCities } from "@/lib/cameroon-cities";
import axios from "axios";
import toast from "react-hot-toast";

const schema = z.object({
  name: z.string().min(2, "Minimum 2 caractères"),
  city: z.string().min(2, "Sélectionnez une ville"),
});

type FormData = z.infer<typeof schema>;

export default function CreateAgencyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const cities = useMemo(() => getCameroonCities(), []);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await axios.post("/api/agencies", data);
      toast.success("Agence créée");
      router.push("/agencies");
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : "Erreur";
      toast.error(msg ?? "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle agence</CardTitle>
          <p className="text-sm text-muted-foreground">Cameroun — sélectionnez la ville de l&apos;agence</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input placeholder="Nom de l'agence (ex: Agence Akwa)" {...register("name")} />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Select onValueChange={(v) => {
                if (v !== null) {
                  setValue("city", v as string, { shouldValidate: true });
                }
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
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => router.back()}>Annuler</Button>
              <Button type="submit" disabled={loading}>{loading ? "Création..." : "Créer"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
