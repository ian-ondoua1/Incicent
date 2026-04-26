"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  incidentId?: string | null;
};

export function NotificationsBell() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => axios.get("/api/notifications").then((r) => r.data.data),
    refetchInterval: 30000, // polling toutes les 30s
  });

  const markAllRead = useMutation({
    mutationFn: () => axios.patch("/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const unread: number = data?.unread ?? 0;
  const notifications: Notification[] = data?.notifications ?? [];

  return (
    <DropdownMenu onOpenChange={(open) => { if (open && unread > 0) markAllRead.mutate(); }}>
      <DropdownMenuTrigger
        render={
          <button className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors" />
        }
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <span className="text-xs text-muted-foreground">{unread} non lue(s)</span>
          )}
        </div>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aucune notification
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              n.incidentId ? (
                <DropdownMenuItem
                  key={n.id}
                  render={<Link href={`/incidents/${n.incidentId}`} />}
                  className="flex-col items-start px-3 py-2.5 cursor-pointer"
                >
                  <div className="flex items-start gap-2 w-full">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                    <div className={!n.read ? "" : "pl-4"}>
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.createdAt).toLocaleString("fr-FR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={n.id} className="flex-col items-start px-3 py-2.5">
                  <div className="flex items-start gap-2 w-full">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                    <div className={!n.read ? "" : "pl-4"}>
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                  </div>
                </DropdownMenuItem>
              )
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
