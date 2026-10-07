import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export function pagination(query: unknown) {
  const { page, limit } = paginationSchema.parse(query);
  return { page, limit, offset: (page - 1) * limit };
}
export function pageResult<T>(data: T[], page: number, limit: number, total: number) {
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
export const isoDate = z.string().datetime({ offset: true });
export function dateRange(from?: string, to?: string) {
  const start = from ? new Date(isoDate.parse(from)) : new Date(Date.now() - 3600000);
  const end = to ? new Date(isoDate.parse(to)) : new Date();
  if (start > end) throw new z.ZodError([{ code: "custom", path: ["from"], message: "from must be before to" }]);
  return { from: start, to: end };
}
