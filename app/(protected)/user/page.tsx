import { Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export default function UserPage() {
  return (
    <section className="mx-auto w-full max-w-[1180px]">
      <div className="border-b border-border pb-[38px]">
        <p className="mb-3.5 text-xs font-extrabold tracking-[0.16em] text-[#68736d] uppercase">
          Management
        </p>
        <h1 className="text-[clamp(48px,7vw,86px)] leading-[0.95] font-bold tracking-[-0.055em]">
          User
        </h1>
        <p className="mt-[18px] text-[15px] text-muted-foreground">用户管理页面。</p>
      </div>

      <Card className="mt-7 min-h-80 justify-center rounded-2xl py-0 ring-border sm:mt-[42px] sm:rounded-[20px]">
        <CardContent className="grid place-items-center px-5 py-12 text-center sm:px-12">
          <div
            className="mb-[18px] grid size-[62px] place-items-center rounded-[18px] bg-[#f0f4e7] text-[#69851e]"
            aria-hidden="true"
          >
            <Users className="size-7" strokeWidth={1.5} />
          </div>
          <CardTitle className="text-[28px] font-bold tracking-[-0.035em]">
            User
          </CardTitle>
          <CardDescription className="mt-2.5 text-base">
            后续可在这里接入用户列表与权限管理。
          </CardDescription>
        </CardContent>
      </Card>
    </section>
  );
}
