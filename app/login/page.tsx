import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();

  if (cookieStore.has(AUTH_COOKIE_NAME)) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-svh bg-white lg:grid lg:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
      <section
        className="mx-auto flex min-h-svh w-full max-w-[560px] flex-col justify-start px-6 py-8 sm:px-12 lg:justify-center lg:px-[72px] lg:py-16"
        aria-labelledby="login-title"
      >
        <div
          className="mb-16 grid size-12 place-items-center rounded-[14px] bg-accent text-2xl font-black tracking-[-0.08em] text-accent-foreground lg:mb-[70px]"
          aria-hidden="true"
        >
          K
        </div>
        <div>
          <p className="mb-3.5 text-xs font-extrabold tracking-[0.16em] text-[#68736d] uppercase">
            Knowledge Hub
          </p>
          <h1
            id="login-title"
            className="text-[clamp(42px,5vw,58px)] leading-none font-bold tracking-[-0.055em]"
          >
            欢迎回来
          </h1>
          <p className="mt-[18px] leading-7 text-muted-foreground">
            登录后进入你的知识管理工作台。
          </p>
        </div>
        <LoginForm />
      </section>

      <aside
        className="relative hidden min-h-svh overflow-hidden bg-[#18221c] text-white lg:block"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.16)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.16)_1px,transparent_1px)] bg-[size:64px_64px] opacity-15 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="absolute top-[14%] right-[-7%] aspect-square w-[min(44vw,620px)] rounded-full bg-accent shadow-[0_0_160px_rgb(200_255_77/0.16)]" />
        <div className="absolute top-[32%] right-[14%] aspect-square w-[min(17vw,250px)] rounded-full border border-white/40 bg-white/10 backdrop-blur-[14px]" />
        <div className="absolute right-[11%] bottom-[11%] left-[11%] max-w-[620px]">
          <span className="text-[11px] font-extrabold tracking-[0.18em] text-accent">
            KNOWLEDGE, ORGANIZED.
          </span>
          <h2 className="mt-[18px] max-w-[560px] text-[clamp(36px,4.5vw,68px)] leading-[1.08] font-bold tracking-[-0.055em]">
            把散落的信息，变成可用的知识。
          </h2>
        </div>
      </aside>
    </main>
  );
}
