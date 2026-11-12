"use client";

import { useEffect, useRef, useState } from "react";
import {
  Eye,
  FileText,
  LoaderCircle,
  RefreshCw,
  Upload,
} from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DOCUMENT_STATUS,
  type DocumentListItem,
  type DocumentListResponse,
  type DocumentStatusValue,
  type DocumentUploadResponse,
} from "@/lib/documents";
import { HttpError, httpService } from "@/services/http";

const PAGE_SIZE = 10;

const statusLabels: Record<number, { label: string; className: string }> = {
  [DOCUMENT_STATUS.PENDING_UPLOAD]: {
    label: "等待上传",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  [DOCUMENT_STATUS.UPLOADED]: {
    label: "已上传",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  [DOCUMENT_STATUS.PARSING]: {
    label: "解析中",
    className: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  [DOCUMENT_STATUS.PARSE_FAILED]: {
    label: "解析失败",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
  [DOCUMENT_STATUS.DRAFT]: {
    label: "草稿",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  [DOCUMENT_STATUS.PENDING_REVIEW]: {
    label: "待审批",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  [DOCUMENT_STATUS.REJECTED]: {
    label: "已驳回",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
  [DOCUMENT_STATUS.INDEXING]: {
    label: "索引中",
    className: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  [DOCUMENT_STATUS.INDEX_FAILED]: {
    label: "索引失败",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
  [DOCUMENT_STATUS.PUBLISHED]: {
    label: "已发布",
    className: "bg-[#f0f7df] text-[#60791c] ring-[#dbe9b7]",
  },
  [DOCUMENT_STATUS.UNPUBLISHED]: {
    label: "已下架",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  [DOCUMENT_STATUS.ARCHIVED]: {
    label: "已归档",
    className: "bg-muted text-muted-foreground ring-border",
  },
};

type UploadState = {
  fileName: string;
  progress: number;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function getUploadTitle(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "") || fileName;
}

function uploadFile(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", uploadUrl);
    Object.entries(headers).forEach(([name, value]) => {
      request.setRequestHeader(name, value);
    });

    request.upload.addEventListener("progress", (event) => {
      const total = event.lengthComputable ? event.total : file.size;

      if (total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / total) * 100)));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error(`对象存储上传失败 (${request.status})`));
    });
    request.addEventListener("error", () => {
      reject(new Error("对象存储连接失败，请稍后重试"));
    });
    request.addEventListener("abort", () => {
      reject(new Error("上传已取消"));
    });
    request.send(file);
  });
}

function DocumentStatus({ status }: { status: DocumentStatusValue }) {
  const value = statusLabels[status] ?? {
    label: `未知 (${status})`,
    className: "bg-muted text-muted-foreground ring-border",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${value.className}`}
    >
      {value.label}
    </span>
  );
}

function LoadingRows() {
  return Array.from({ length: 5 }, (_, index) => (
    <TableRow key={index} aria-hidden="true">
      {Array.from({ length: 7 }, (__, cellIndex) => (
        <TableCell key={cellIndex}>
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

function DocumentRow({ document }: { document: DocumentListItem }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {document.id}
      </TableCell>
      <TableCell>
        <div className="flex min-w-52 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf2e4] text-[#66801f]">
            <FileText className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <strong className="block max-w-72 truncate font-semibold text-foreground">
              {document.title}
            </strong>
            <span className="block max-w-72 truncate text-xs text-muted-foreground">
              {document.file_name}
            </span>
          </span>
        </div>
      </TableCell>
      <TableCell className="max-w-48 truncate text-muted-foreground">
        {document.content_type}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatFileSize(document.file_size)}
      </TableCell>
      <TableCell>
        <DocumentStatus status={document.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(document.created_at)}
      </TableCell>
      <TableCell className="text-right">
        {document.status >= DOCUMENT_STATUS.DRAFT ? (
          <Link
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            href={`/document/${document.id}`}
            aria-label={`查看${document.title}详情`}
            title="查看详情"
          >
            <Eye />
          </Link>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function DocumentTable() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<DocumentListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadDocuments() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await httpService.get<DocumentListResponse>(
          `documents?page=${page}&size=${PAGE_SIZE}`,
          { signal: controller.signal },
        );

        if (!isActive) {
          return;
        }

        if (response.pages > 0 && page > response.pages) {
          setPage(response.pages);
          return;
        }

        setData(response);
      } catch (requestError) {
        if (!isActive) {
          return;
        }

        if (requestError instanceof HttpError) {
          setError(
            requestError.status === 403
              ? "当前账号没有查看文档列表的权限"
              : requestError.message,
          );
        } else {
          setError("文档列表加载失败，请稍后重试");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [page, reloadKey]);

  async function handleFileChange(file: File | undefined) {
    if (!file) {
      return;
    }

    if (file.size === 0) {
      setUploadError("不能上传空文件");
      return;
    }

    let documentId: number | null = null;
    let objectUploaded = false;

    setUploadError(null);
    setUploadState({ fileName: file.name, progress: 0 });

    try {
      const upload = await httpService.post<DocumentUploadResponse>(
        "documents/uploads",
        {
          title: getUploadTitle(file.name),
          file_name: file.name,
          content_type: file.type || "application/octet-stream",
          file_size: file.size,
        },
      );
      documentId = upload.document.id;

      await uploadFile(upload.upload_url, file, upload.headers, (progress) => {
        setUploadState({ fileName: file.name, progress });
      });
      objectUploaded = true;

      await httpService.post<DocumentListItem>(
        `documents/${documentId}/upload-complete`,
      );
      setPage(1);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      if (documentId && !objectUploaded) {
        await httpService
          .delete<void>(`documents/${documentId}`)
          .catch(() => undefined);
      }

      setUploadError(
        requestError instanceof Error
          ? requestError.message
          : "文件上传失败，请稍后重试",
      );
    } finally {
      setUploadState(null);
    }
  }

  return (
    <Card className="min-h-0 flex-1 gap-0 rounded-2xl py-0 ring-border sm:rounded-[20px]">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-semibold">我的文档</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            上传的文件会直接保存到对象存储
          </p>
        </div>

        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void handleFileChange(file);
          }}
        />
        <Button
          type="button"
          size="lg"
          disabled={uploadState !== null}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadState ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Upload />
          )}
          {uploadState ? `${uploadState.progress}%` : "上传文件"}
        </Button>
      </div>

      {uploadState ? (
        <div className="shrink-0 border-b border-border bg-[#f8faf5] px-4 py-3 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-4 text-xs">
            <span className="truncate font-medium">{uploadState.fileName}</span>
            <span className="font-mono text-muted-foreground">
              {uploadState.progress}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e2e8dc]">
            <div
              className="h-full rounded-full bg-[#8aa533] transition-[width]"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {uploadError ? (
        <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 sm:px-5">
          {uploadError}
        </div>
      ) : null}

      {error ? (
        <div className="grid min-h-0 flex-1 place-items-center px-5 py-12 text-center">
          <div>
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <FileText className="size-5" />
            </div>
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
        </div>
      ) : (
        <>
          <Table containerClassName="table-scrollbar min-h-0 flex-1 overflow-auto overscroll-contain">
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-[#f7f8f6]">
              <TableRow className="hover:bg-transparent">
                <TableHead>ID</TableHead>
                <TableHead>文档</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>大小</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRows /> : null}
              {!isLoading && data?.items.length
                ? data.items.map((document) => (
                    <DocumentRow key={document.id} document={document} />
                  ))
                : null}
              {!isLoading && data?.items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-56 text-center">
                    <FileText className="mx-auto mb-3 size-6 text-muted-foreground" />
                    <p className="font-medium">暂无文档</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      点击右上角按钮上传第一份文档。
                    </p>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <Pagination
            page={data?.page ?? page}
            pageSize={data?.size ?? PAGE_SIZE}
            total={data?.total ?? 0}
            totalPages={data?.pages ?? 0}
            disabled={isLoading}
            ariaLabel="文档列表分页"
            onPageChange={setPage}
          />
        </>
      )}
    </Card>
  );
}
