"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, LayoutDashboard, Search, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { CurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { HttpError, httpService } from "@/services/http";

import { LogoutButton } from "./logout-button";

const navigation = [
  {
    href: "/dashboard",
    label: "仪表盘",
    icon: LayoutDashboard,
  },
  {
    href: "/search",
    label: "搜索",
    icon: Search,
  },
  {
    href: "/document",
    label: "文档管理",
    icon: FileText,
  },
  {
    href: "/user",
    label: "用户管理",
    icon: Users,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadCurrentUser() {
      try {
        const currentUser = await httpService.get<CurrentUser>("auth/me", {
          signal: controller.signal,
        });

        if (isActive) {
          setUser(currentUser);
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error instanceof HttpError && error.status === 401) {
          await httpService.post<void>("auth/logout").catch(() => undefined);
          router.replace("/login");
          router.refresh();
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [router]);

  const displayName = isLoading
    ? "加载中..."
    : (user?.username ?? "Knowledge User");
  const subtitle = isLoading
    ? "正在获取用户信息"
    : (user?.role.name ?? user?.email ?? "已登录");

  return (
    <aside className="sticky top-0 flex h-svh w-[68px] shrink-0 flex-col items-center bg-sidebar px-[9px] py-4 text-sidebar-foreground sm:w-[82px] sm:px-[13px] sm:py-[22px] lg:w-[264px] lg:items-stretch lg:px-5 lg:pt-7 lg:pb-5">
      <Link
        className="flex items-center gap-3 lg:px-2"
        href="/dashboard"
        aria-label="Knowledge Hub 首页"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-sidebar-primary text-[19px] font-black tracking-[-0.08em] text-sidebar-primary-foreground lg:size-[38px]">
          K
        </span>
        <span className="hidden gap-0.5 lg:grid">
          <strong className="text-[15px] tracking-[-0.02em]">Knowledge</strong>
          <small className="text-[8px] font-extrabold tracking-[0.25em] text-sidebar-primary">
            HUB
          </small>
        </span>
      </Link>

      <nav className="mt-[42px] grid w-full gap-1.5 lg:mt-[58px]" aria-label="主菜单">
        <p className="mx-3 mb-3 hidden text-[10px] font-extrabold tracking-[0.14em] text-[#657169] uppercase lg:block">
          工作台
        </p>
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex h-12 items-center justify-center gap-[13px] rounded-[10px] text-sm font-semibold text-[#a8b2ac] transition-colors hover:bg-white/5 hover:text-white lg:justify-start lg:px-[13px]",
                isActive && "bg-sidebar-primary/10 text-white",
              )}
              aria-current={isActive ? "page" : undefined}
              title={item.label}
            >
              <Icon className="size-[19px] shrink-0" strokeWidth={1.65} />
              <span className="hidden lg:inline">{item.label}</span>
              {isActive ? (
                <span className="absolute bottom-[5px] left-1/2 size-1 -translate-x-1/2 rounded-full bg-sidebar-primary lg:top-1/2 lg:right-3 lg:bottom-auto lg:left-auto lg:size-1.5 lg:translate-x-0 lg:-translate-y-1/2" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex w-full flex-col items-center gap-2.5 border-t border-sidebar-border pt-4 lg:flex-row lg:px-1">
        <Avatar className="size-9 bg-[#334037] after:border-0">
          <AvatarFallback className="bg-[#334037] text-[13px] font-extrabold text-sidebar-primary">
            {displayName.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 flex-1 gap-0.5 lg:grid">
          <strong className="truncate text-xs">{displayName}</strong>
          <span className="truncate text-[10px] text-[#8f9c94]">{subtitle}</span>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
