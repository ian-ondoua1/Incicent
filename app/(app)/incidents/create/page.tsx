"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, X, FileVideo, ImageIcon } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

const ACCEPTED = "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,video/x-msvideo";

const schema = z.object({
  title: z.string().min(3, "Minimum 3 caractères"),
  description: z.string().min(10, "Minimum 10 caractères"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  category: z.string().optional(),
  agencyId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function CreateIncidentPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAdmin = session?.user.role === "ADMIN";

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "MEDIUM" },
  });

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: () => axios.get("/api/agencies").then((r) => r.data.data),
    enabled: !!session && isAdmin,
  });

  const handleFile = useCallback((f: File) => {
    const isImage = f.type.startsWith("image/");
    const isVideo = f.type.startsWith("video/");
    if (!isImage && !isVideo) { toast.error("Format non accepté. Image ou vidéo uniquement."); return; }
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (f.size > maxSize) { toast.error(`Trop volumineux (max ${isVideo ? "100 MB" : "10 MB"})`); return; }
    setFile(f);
    if (isImage) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await axios.post("/api/incidents", data);
      const incidentId: string = res.data.data.id;

      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("incidentId", incidentId);
        await axios.post("/api/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      toast.success("Incident créé");
      router.push(`/incidents/${incidentId}`);
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : "Erreur lors de la création";
      toast.error(msg ?? "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader><CardTitle>Nouveau incident</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <div>
              <Input placeholder="Titre" {...register("title")} />
              {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <Textarea placeholder="Description détaillée..." rows={4} {...register("description")} />
              {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select defaultValue="MEDIUM" onValueChange={(v) => setValue("priority", v as FormData["priority"])}>
                <SelectTrigger><SelectValue placeholder="Priorité" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Basse</SelectItem>
                  <SelectItem value="MEDIUM">Moyenne</SelectItem>
                  <SelectItem value="HIGH">Haute</SelectItem>
                  <SelectItem value="CRITICAL">Critique</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Catégorie (optionnel)" {...register("category")} />
            </div>

            {isAdmin && agencies && (
              <Select onValueChange={(v) => {
                if (v !== null) {
                  setValue("agencyId", v as string, { shouldValidate: true });
                } else {
                  setValue("agencyId", undefined, { shouldValidate: true });
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une agence" /></SelectTrigger>
                <SelectContent>
                  {agencies.map((a: { id: string; name: string; city: string }) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} — {a.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Zone d'upload */}
            <div>
              <p className="text-sm font-medium mb-2">Pièce jointe (optionnel)</p>
              {!file ? (
                <div
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer
                    ${dragging ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-400"}`}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Glissez une image ou vidéo ici, ou <span className="font-medium text-black underline">cliquez pour choisir</span>
                  </p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, GIF, WEBP, MP4, MOV, WEBM — Max 10 MB (image) / 100 MB (vidéo)</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED}
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </div>
              ) : (
                <div className="relative rounded-lg border bg-gray-50 p-3">
                  <button
                    type="button"
                    onClick={removeFile}
                    className="absolute right-2 top-2 rounded-full bg-white border p-0.5 shadow hover:bg-red-50"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </button>

                  {preview ? (
                    <img src={preview} alt="preview" className="max-h-48 w-full rounded object-contain" />
                  ) : (
                    <div className="flex items-center gap-3 py-2">
                      <FileVideo className="h-8 w-8 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    {file.type.startsWith("image/") ? (
                      <ImageIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <FileVideo className="h-4 w-4 text-blue-500" />
                    )}
                    <span className="text-xs text-muted-foreground truncate">{file.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => router.back()}>Annuler</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Création en cours..." : "Créer l'incident"}
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
