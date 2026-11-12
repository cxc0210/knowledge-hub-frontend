import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <main className="min-w-0 flex-1 px-[18px] py-8 sm:px-6 sm:py-[38px] lg:p-[clamp(40px,6vw,82px)]">
        {children}
      </main>
    </div>
  );
}
