"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    await api.post("/auth/logout");
    router.push("/");
    router.refresh();
  };

  return (
    <Button variant="outline" onClick={logout}>
      Sign Out
    </Button>
  );
}
