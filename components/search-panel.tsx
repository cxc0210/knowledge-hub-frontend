"use client";

import { FileSearch, LoaderCircle, Search } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import type {
  DocumentSearchItem,
  DocumentSearchResponse,
} from "@/lib/search";
import { HttpError, httpService } from "@/services/http";

const PAGE_SIZE = 10;
const HIGHLIGHT_START = "\ue000";
const HIGHLIGHT_END = "\ue001";

function HighlightText({ value }: { value: string }) {
  const parts = value.split(/([\ue000\ue001])/g);
  let isHighlighted = false;

  return parts.map((part, index) => {
    if (part === HIGHLIGHT_START) {
      isHighlighted = true;
      return null;
    }
    if (part === HIGHLIGHT_END) {
      isHighlighted = false;
      return null;
    }
    if (!part) {
      return null;
    }

    return isHighlighted ? (
      <mark
        key={`${index}-${part}`}
        className="rounded-sm bg-accent/80 px-0.5 font-semibold text-accent-foreground"
      >
        {part}
      </mark>
    ) : (
      <span key={`${index}-${part}`}>{part}</span>
    );
  });
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function SearchResult({ item }: { item: DocumentSearchItem }) {
  const publishDate = formatDate(item.publish_time);

  return (
    <Card className="gap-4 rounded-2xl px-5 py-5 transition-shadow hover:shadow-sm sm:px-6">
      <div className="flex min-w-0 items-start gap-4">
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#eff5df] text-[#66801f]">
          <FileSearch className="size-[18px]" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={`/document/${item.document_id}`}
              className="break-words text-lg font-bold tracking-[-0.02em] hover:text-[#66801f] hover:underline hover:underline-offset-4"
            >
              <HighlightText value={item.highlighted_title ?? item.title} />
            </Link>
            {publishDate ? (
              <span className="text-xs text-muted-foreground">
                发布于 {publishDate}
              </span>
            ) : null}
          </div>

          {item.heading ? (
            <p className="mt-1 text-xs font-semibold text-[#758078]">
              {item.heading}
            </p>
          ) : null}

          <div className="mt-3 grid gap-2 text-sm leading-7 text-[#4e5b54]">
            {item.snippets.map((snippet, index) => (
              <p key={`${item.document_id}-${index}`}>
                <HighlightText value={snippet} />
              </p>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SearchLoading() {
  return (
    <div className="grid gap-3" aria-label="正在搜索文档">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="h-36 animate-pulse rounded-2xl bg-card ring-1 ring-foreground/10"
        />
      ))}
    </div>
  );
}

export function SearchPanel() {
  const [keyword, setKeyword] = useState("");
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [data, setData] = useState<DocumentSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  async function searchDocuments(query: string, page: number) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        size: String(PAGE_SIZE),
      });
      const response = await httpService.get<DocumentSearchResponse>(
        `search?${params.toString()}`,
        { signal: controller.signal },
      );

      if (!controller.signal.aborted) {
        setData(response);
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(
          requestError instanceof HttpError
            ? requestError.message
            : "搜索失败，请稍后重试",
        );
      }
    } finally {
      if (controllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = keyword.trim();

    if (!query) {
      setError("请输入要搜索的关键词");
      setData(null);
      setSearchedKeyword("");
      return;
    }

    setSearchedKeyword(query);
    setData(null);
    void searchDocuments(query, 1);
  }

  function handlePageChange(page: number) {
    if (!searchedKeyword || page === data?.page) {
      return;
    }

    void searchDocuments(searchedKeyword, page).then(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="mt-6 sm:mt-8">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        role="search"
        onSubmit={handleSubmit}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="h-12 rounded-xl bg-card pr-4 pl-11 text-base shadow-sm md:text-base"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="输入文档标题或内容关键词"
            aria-label="搜索关键词"
            maxLength={200}
            autoFocus
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-12 rounded-xl px-6"
          disabled={isLoading}
        >
          {isLoading ? <LoaderCircle className="animate-spin" /> : <Search />}
          搜索
        </Button>
      </form>

      <div ref={resultsRef} className="scroll-mt-8 pt-7">
        {isLoading && !data ? <SearchLoading /> : null}

        {!isLoading && error ? (
          <Card className="rounded-2xl px-5 py-10 text-center">
            <p className="font-semibold text-destructive">{error}</p>
          </Card>
        ) : null}

        {!isLoading && !error && !data ? (
          <Card className="grid min-h-72 place-items-center rounded-2xl px-5 text-center">
            <CardContent>
              <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Search className="size-5" />
              </span>
              <p className="font-semibold">输入关键词搜索已发布文档</p>
            </CardContent>
          </Card>
        ) : null}

        {!error && data ? (
          <div className={isLoading ? "opacity-60" : undefined}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold tracking-[-0.02em]">搜索结果</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  “{data.query}” 找到 {data.total} 篇文档，用时 {data.took_ms} ms
                </p>
              </div>
            </div>

            {data.items.length ? (
              <div className="grid gap-3">
                {data.items.map((item) => (
                  <SearchResult key={item.document_id} item={item} />
                ))}

                <Card className="gap-0 rounded-2xl py-0">
                  <Pagination
                    page={data.page}
                    pageSize={data.size}
                    total={data.total}
                    totalPages={data.pages}
                    onPageChange={handlePageChange}
                    disabled={isLoading}
                    ariaLabel="搜索结果分页"
                  />
                </Card>
              </div>
            ) : (
              <Card className="grid min-h-64 place-items-center rounded-2xl px-5 text-center">
                <CardContent>
                  <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                    <FileSearch className="size-5" />
                  </span>
                  <p className="font-semibold">没有找到相关文档</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    可以尝试更短或不同的关键词
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
