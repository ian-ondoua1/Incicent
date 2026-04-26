"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="border-b bg-background px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-bold text-lg">
          IncidentPortal
        </Link>
        <Link href="/incidents" className="text-sm text-muted-foreground hover:text-foreground">
          Incidents
        </Link>
        <Link href="/agencies" className="text-sm text-muted-foreground hover:text-foreground">
          Agences
        </Link>
        {(session?.user.role === "ADMIN" || session?.user.role === "SUPPORT") && (
          <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
            Admin
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link href="/incidents/create">
          <Button size="sm">Nouveau</Button>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback>{session?.user.name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5 text-sm font-medium">{session?.user.name}</div>
            <div className="px-2 pb-1.5 text-xs text-muted-foreground">{session?.user.email}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              Profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="text-red-500">
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
