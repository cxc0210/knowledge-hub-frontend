"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { httpService } from "@/services/http";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    const formData = new FormData(event.currentTarget);

    try {
      await httpService.post("auth/login", {
        username_or_email: formData.get("username_or_email"),
        password: formData.get("password"),
      });

      router.replace("/dashboard");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "登录失败，请稍后重试");
      setIsPending(false);
    }
  }

  return (
    <form className="mt-10 grid gap-5 lg:mt-12" method="post" onSubmit={handleSubmit}>
      <div className="grid gap-2.5">
        <Label htmlFor="username_or_email" className="text-[13px] font-bold text-[#36413b]">
          用户名或邮箱
        </Label>
        <Input
          id="username_or_email"
          name="username_or_email"
          type="text"
          autoComplete="username"
          placeholder="请输入用户名或邮箱"
          className="h-[54px] rounded-[10px] bg-[#fbfcfb] px-4 text-base shadow-none transition-colors placeholder:text-[#a3aba6] focus-visible:border-[#8aa533] focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-accent/20"
          required
          autoFocus
        />
      </div>

      <div className="grid gap-2.5">
        <Label htmlFor="password" className="text-[13px] font-bold text-[#36413b]">
          密码
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="请输入密码"
          className="h-[54px] rounded-[10px] bg-[#fbfcfb] px-4 text-base shadow-none transition-colors placeholder:text-[#a3aba6] focus-visible:border-[#8aa533] focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-accent/20"
          required
        />
      </div>

      {error ? (
        <p
          className="-mt-1 rounded-lg bg-[#fff0f0] px-[13px] py-[11px] text-[13px] leading-5 text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Button
        className="mt-2 h-14 w-full justify-between rounded-[10px] bg-primary px-5 text-base font-bold text-primary-foreground hover:bg-[#223229]"
        size="lg"
        type="submit"
        disabled={isPending}
      >
        <span>{isPending ? "正在登录..." : "登录"}</span>
        <ArrowRight className="size-5 text-accent" aria-hidden="true" />
      </Button>
    </form>
  );
}
