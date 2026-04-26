"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import toast from "react-hot-toast";

const schema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(4, "Minimum 4 caractères"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const res = await signIn("credentials", { ...data, redirect: false });
    setLoading(false);
    if (res?.error) {
      toast.error("Email ou mot de passe incorrect");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex h-svh">

      {/* ── Colonne gauche — image ── */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80')`,
          }}
        />
        {/* overlay gradient */}
        <div className="absolute inset-0 bg-black/40" />
        {/* texte sur l'image */}
        <div className="absolute bottom-10 left-10 text-white">
          <p className="text-2xl font-bold leading-snug max-w-xs">
            Gérez vos incidents en toute sérénité.
          </p>
          <p className="text-sm text-white/70 mt-2">ETS MARCEL RECORDZ</p>
        </div>
      </div>

      {/* ── Colonne droite — formulaire ── */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-white px-4">
        <div className="w-full max-w-md space-y-8">

          {/* Titre */}
          <div>
            <h2 className="text-3xl font-bold text-[#0a0a0a]">Bon retour</h2>
            <p className="mt-2 text-sm text-[#6B7280]">Connectez-vous à votre compte pour continuer.</p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Adresse e-mail"
                  className="h-9 border-[#D1D5DB] bg-transparent text-sm placeholder:text-[#9CA3AF] focus-visible:ring-1 focus-visible:ring-[#0a0a0a]"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Mot de passe"
                  className="h-9 border-[#D1D5DB] bg-transparent text-sm placeholder:text-[#9CA3AF] focus-visible:ring-1 focus-visible:ring-[#0a0a0a]"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>
            </div>

            {/* Mot de passe oublié */}
            <div className="text-end">
              <Link
                href="/forgot-password"
                className="inline-block text-sm text-[#0a0a0a] underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            {/* Bouton submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 rounded-md bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {loading ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>

          {/* Lien inscription */}
          <p className="mt-6 text-center text-sm text-[#0a0a0a]">
            Vous n&apos;avez pas encore de compte ?{" "}
            <Link href="/register" className="underline">
              Créer un compte
            </Link>
          </p>

        </div>
      </div>

    </div>
  );
}
