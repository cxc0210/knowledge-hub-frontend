import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <section className="mx-auto w-full max-w-[1180px]">
      <div className="border-b border-border pb-[38px]">
        <p className="mb-3.5 text-xs font-extrabold tracking-[0.16em] text-[#68736d] uppercase">
          Dashboard
        </p>
        <h1 className="text-[clamp(48px,7vw,86px)] leading-[0.95] font-bold tracking-[-0.055em]">
          Welcome
        </h1>
        <p className="mt-[18px] text-[15px] text-muted-foreground">
          欢迎来到 Knowledge Hub。
        </p>
      </div>

      <Card className="mt-7 min-h-[360px] gap-0 rounded-2xl bg-primary py-0 text-primary-foreground ring-0 sm:mt-[42px] sm:rounded-[22px] lg:min-h-[310px]">
        <CardContent className="relative flex flex-1 items-end justify-between gap-12 overflow-hidden rounded-[inherit] p-7 sm:p-[clamp(30px,5vw,58px)]">
          <div className="absolute -top-60 -right-40 size-[500px] rounded-full border-[80px] border-accent/10" />
          <div className="relative z-10 max-w-[560px]">
            <span className="text-[10px] font-extrabold tracking-[0.16em] text-accent">
              YOUR KNOWLEDGE SPACE
            </span>
            <h2 className="mt-5 mb-3 text-[clamp(30px,4vw,48px)] font-bold tracking-[-0.045em]">
              一切准备就绪。
            </h2>
            <p className="leading-7 text-[#aab4ae]">
              这里将展示你的知识库概览、最近活动和常用入口。
            </p>
          </div>
          <div
            className="relative hidden size-[152px] shrink-0 items-center justify-center md:flex"
            aria-hidden="true"
          >
            <span className="absolute size-full rounded-full border border-white/20" />
            <span className="absolute size-[68%] rounded-full border border-accent/45" />
            <span className="absolute size-1/4 rounded-full bg-accent shadow-[0_0_44px_rgb(200_255_77/0.45)]" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
