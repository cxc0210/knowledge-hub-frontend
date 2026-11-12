"use client";

import { ArrowLeft, FileText, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DocumentDetailResponse } from "@/lib/documents";
import { HttpError, httpService } from "@/services/http";

function getErrorMessage(error: unknown) {
  if (!(error instanceof HttpError)) {
    return "文档详情加载失败，请稍后重试";
  }

  if (error.status === 403) {
    return "你没有查看这份文档的权限";
  }
  if (error.status === 404) {
    return "文档不存在或已被删除";
  }
  if (error.status === 409) {
    return "文档内容尚未准备完成";
  }
  return error.message;
}

function LoadingDetail() {
  return (
    <div className="grid gap-5" aria-label="正在加载文档详情">
      <div className="h-36 animate-pulse rounded-[20px] bg-card" />
      <div className="h-[520px] animate-pulse rounded-[20px] bg-card" />
    </div>
  );
}

export function DocumentDetail({ documentId }: { documentId: number }) {
  const [data, setData] = useState<DocumentDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadDocument() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await httpService.get<DocumentDetailResponse>(
          `documents/${documentId}/detail`,
          { signal: controller.signal },
        );

        if (isActive) {
          setData(response);
        }
      } catch (requestError) {
        if (isActive) {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [documentId, reloadKey]);

  return (
    <section
      data-document-detail-page
      className="mx-auto w-full max-w-[980px]"
    >
      <Link
        className={buttonVariants({ variant: "ghost", size: "default" })}
        href="/document"
      >
        <ArrowLeft />
        返回文档列表
      </Link>

      <div className="mt-5">
        {isLoading ? <LoadingDetail /> : null}

        {!isLoading && error ? (
          <Card className="grid min-h-80 place-items-center rounded-[20px] px-5 text-center">
            <div>
              <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <FileText className="size-5" />
              </span>
              <p className="font-semibold">{error}</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setReloadKey((value) => value + 1)}
              >
                <RefreshCw />
                重新加载
              </Button>
            </div>
          </Card>
        ) : null}

        {!isLoading && data ? (
          <div className="grid gap-5">
            <Card className="gap-5 rounded-[20px] px-5 py-6 sm:px-8 sm:py-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div className="min-w-0">
                  <p className="mb-2 text-xs font-bold tracking-[0.14em] text-[#7b8b82] uppercase">
                    Document
                  </p>
                  <h1 className="break-words text-2xl font-bold tracking-[-0.035em] sm:text-4xl">
                    {data.document.title}
                  </h1>
                </div>

                <div className="flex shrink-0 items-center gap-3 rounded-xl bg-[#f3f6ee] px-3 py-2.5">
                  <Avatar className="size-9 bg-[#e5eed1] after:border-0">
                    {data.author.avatar_url ? (
                      <AvatarImage
                        src={data.author.avatar_url}
                        alt={`${data.author.username} 的头像`}
                      />
                    ) : null}
                    <AvatarFallback className="bg-[#e5eed1] text-xs font-bold text-[#66801f]">
                      {data.author.username.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    <small className="block text-[10px] font-semibold text-muted-foreground">
                      上传者
                    </small>
                    <strong className="block text-sm">
                      {data.author.username}
                    </strong>
                  </span>
                </div>
              </div>
            </Card>

            <Card className="rounded-[20px] px-5 py-7 sm:px-9 sm:py-10">
              <article className="markdown-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {data.markdown}
                </ReactMarkdown>
              </article>
            </Card>
          </div>
        ) : null}
      </div>
    </section>
  );
}
