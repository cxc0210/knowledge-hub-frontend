"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationItem = number | string;

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

function getPaginationItems(page: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  pages.forEach((item, index) => {
    const previous = pages[index - 1];

    if (previous && item - previous > 1) {
      items.push(`ellipsis-${previous}-${item}`);
    }

    items.push(item);
  });

  return items;
}

function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  disabled = false,
  ariaLabel = "列表分页",
}: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const items = getPaginationItems(page, totalPages);

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        显示第 {start}–{end} 条，共 {total} 条
      </p>

      <nav className="flex items-center gap-1" aria-label={ariaLabel}>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="上一页"
        >
          <ChevronLeft />
        </Button>

        {items.map((item) =>
          typeof item === "number" ? (
            <Button
              key={item}
              type="button"
              variant={item === page ? "default" : "ghost"}
              size="icon-sm"
              disabled={disabled}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              aria-label={`第 ${item} 页`}
            >
              {item}
            </Button>
          ) : (
            <span
              key={item}
              className="grid size-7 place-items-center text-muted-foreground"
              aria-hidden="true"
            >
              <MoreHorizontal className="size-4" />
            </span>
          ),
        )}

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled || totalPages === 0 || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="下一页"
        >
          <ChevronRight />
        </Button>
      </nav>
    </div>
  );
}

export { Pagination };
export type { PaginationProps };
