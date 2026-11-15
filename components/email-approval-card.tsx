"use client";

import { Check, LoaderCircle, Mail, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  AI_ACTION_STATUS,
  approveEmailAction,
  type EmailAction,
  rejectEmailAction,
} from "@/lib/ai-actions";
import { cn } from "@/lib/utils";

type EmailApprovalCardProps = {
  action: EmailAction;
  onChange: (action: EmailAction) => void;
};

export function EmailApprovalCard({
  action,
  onChange,
}: EmailApprovalCardProps) {
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPending = action.status === AI_ACTION_STATUS.pending;
  const isLoading = decision !== null;

  async function decide(nextDecision: "approve" | "reject") {
    if (!isPending || isLoading) {
      return;
    }

    setDecision(nextDecision);
    setError(null);

    try {
      const updatedAction =
        nextDecision === "approve"
          ? await approveEmailAction(action.id)
          : await rejectEmailAction(action.id);
      onChange(updatedAction);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "操作失败，请稍后重试",
      );
    } finally {
      setDecision(null);
    }
  }

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <Mail className="size-4 shrink-0 text-primary" />
          待发送邮件
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs",
            statusClassName(action.status),
          )}
        >
          {statusLabel(action.status)}
        </span>
      </header>

      <dl className="grid gap-3 px-4 py-3 text-sm">
        <div className="grid gap-1 sm:grid-cols-[4.5rem_1fr] sm:gap-3">
          <dt className="text-muted-foreground">收件人</dt>
          <dd className="break-all">{action.recipients.join(", ")}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[4.5rem_1fr] sm:gap-3">
          <dt className="text-muted-foreground">主题</dt>
          <dd className="font-medium">{action.subject}</dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[4.5rem_1fr] sm:gap-3">
          <dt className="text-muted-foreground">正文</dt>
          <dd className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/70 px-3 py-2 leading-6">
            {action.body}
          </dd>
        </div>
      </dl>

      {error || action.error_message ? (
        <p className="px-4 pb-3 text-sm text-destructive" role="alert">
          {error ?? action.error_message}
        </p>
      ) : null}

      {isPending ? (
        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => void decide("reject")}
          >
            {decision === "reject" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <X />
            )}
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isLoading}
            onClick={() => void decide("approve")}
          >
            {decision === "approve" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Check />
            )}
            确认发送
          </Button>
        </footer>
      ) : null}
    </section>
  );
}

function statusLabel(status: number) {
  switch (status) {
    case AI_ACTION_STATUS.executing:
      return "发送中";
    case AI_ACTION_STATUS.succeeded:
      return "已发送";
    case AI_ACTION_STATUS.failed:
      return "发送失败";
    case AI_ACTION_STATUS.rejected:
      return "已取消";
    case AI_ACTION_STATUS.expired:
      return "已过期";
    default:
      return "等待确认";
  }
}

function statusClassName(status: number) {
  switch (status) {
    case AI_ACTION_STATUS.succeeded:
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case AI_ACTION_STATUS.failed:
      return "bg-destructive/15 text-destructive";
    case AI_ACTION_STATUS.rejected:
    case AI_ACTION_STATUS.expired:
      return "bg-muted text-muted-foreground";
    default:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }
}
