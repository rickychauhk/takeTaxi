import { ADMIN_LIST_PAGE_SIZE, Paginated } from '@taxima/shared';

export function parsePageQuery(
  pageRaw?: string,
  pageSizeRaw?: string,
  maxPageSize: number = ADMIN_LIST_PAGE_SIZE,
) {
  const page = Math.max(1, Number(pageRaw) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(pageSizeRaw) || maxPageSize));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
