"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { NotificationsBell } from "@/components/notifications-bell";
import { MapPin } from "lucide-react";

const ROLE_STYLES: Record<string, { label: string; className: string }> = {
  ADMIN:   { label: "Admin",   className: "bg-black text-white" },
  SUPPORT: { label: "Support", className: "bg-blue-100 text-blue-700" },
  USER:    { label: "User",    className: "bg-gray-100 text-gray-600" },
};

export function HeaderUserRole() {
  const { data: session } = useSession();

  const { data: agency } = useQuery({
    queryKey: ["my-agency"],
    queryFn: () => axios.get("/api/me/agency").then((r) => r.data.data),
    enabled: !!session && session.user.role === "USER",
  });

  if (!session?.user.role) return null;

  const role = ROLE_STYLES[session.user.role] ?? { label: session.user.role, className: "bg-gray-100 text-gray-600" };

  return (
    <div className="flex items-center gap-3">
      {agency && (
        <div className="hidden md:flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="leading-tight">
            <p className="text-xs font-semibold text-foreground">{agency.name}</p>
            <p className="text-[10px] text-muted-foreground">{agency.city}</p>
          </div>
        </div>
      )}

      <NotificationsBell />

      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-sm text-muted-foreground max-w-[160px] truncate">
          {session.user.name}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${role.className}`}>
          {role.label}
        </span>
      </div>
    </div>
  );
}
