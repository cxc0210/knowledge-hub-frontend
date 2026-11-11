import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar";
import {
  AUTH_COOKIE_NAME,
  type CurrentUser,
} from "@/lib/auth";
import { requestBackend } from "@/services/backend-http";

async function getCurrentUser(token: string): Promise<CurrentUser | null> {
  try {
    const response = await requestBackend("auth/me", {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CurrentUser;
  } catch {
    return null;
  }
}

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const user = await getCurrentUser(token);

  return (
    <div className="flex min-h-svh">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 px-[18px] py-8 sm:px-6 sm:py-[38px] lg:p-[clamp(40px,6vw,82px)]">
        {children}
      </main>
    </div>
  );
}
