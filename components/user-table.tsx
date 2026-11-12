"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import type { UserListItem, UserListResponse } from "@/lib/users";
import { HttpError, httpService } from "@/services/http";

const PAGE_SIZE = 10;

const statusLabels: Record<number, { label: string; className: string }> = {
  0: {
    label: "待验证",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  1: {
    label: "正常",
    className: "bg-[#f0f7df] text-[#60791c] ring-[#dbe9b7]",
  },
  2: {
    label: "已禁用",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
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
  }).format(date);
}

function UserStatus({ status }: { status: number }) {
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
      {Array.from({ length: 6 }, (__, cellIndex) => (
        <TableCell key={cellIndex}>
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

function UserRow({ user }: { user: UserListItem }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {user.id}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-8 bg-[#edf2e4] after:border-0">
            {user.avatar_url ? (
              <AvatarImage src={user.avatar_url} alt={`${user.username} 的头像`} />
            ) : null}
            <AvatarFallback className="bg-[#edf2e4] text-xs font-bold text-[#66801f]">
              {user.username.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-semibold text-foreground">{user.username}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
          {user.role.name}
        </span>
      </TableCell>
      <TableCell>
        <UserStatus status={user.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(user.created_at)}
      </TableCell>
    </TableRow>
  );
}

export function UserTable() {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<UserListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadUsers() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await httpService.get<UserListResponse>(
          `users?page=${page}&size=${PAGE_SIZE}`,
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
              ? "当前账号没有查看用户列表的权限"
              : requestError.message,
          );
        } else {
          setError("用户列表加载失败，请稍后重试");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [page, reloadKey]);

  return (
    <Card className="min-h-0 flex-1 gap-0 rounded-2xl py-0 ring-border sm:rounded-[20px]">
      {error ? (
        <div className="grid min-h-0 flex-1 place-items-center px-5 py-12 text-center">
          <div>
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Users className="size-5" />
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
                <TableHead>用户</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建日期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRows /> : null}
              {!isLoading && data?.items.length
                ? data.items.map((user) => <UserRow key={user.id} user={user} />)
                : null}
              {!isLoading && data?.items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-56 text-center">
                    <Users className="mx-auto mb-3 size-6 text-muted-foreground" />
                    <p className="font-medium">暂无用户</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      当前还没有可显示的用户数据。
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
            onPageChange={setPage}
          />
        </>
      )}
    </Card>
  );
}
