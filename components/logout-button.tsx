"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { httpService } from "@/services/http";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    setIsPending(true);

    try {
      await httpService.post<void>("auth/logout");
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button
      className="size-[34px] shrink-0 text-[#8f9c94] hover:bg-white/10 hover:text-white"
      variant="ghost"
      size="icon"
      type="button"
      onClick={logout}
      disabled={isPending}
      aria-label="退出登录"
      title="退出登录"
    >
      <LogOut className="size-[17px]" strokeWidth={1.8} aria-hidden="true" />
    </Button>
  );
}
