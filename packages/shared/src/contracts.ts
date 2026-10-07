import { z } from "zod";
export const paginationSchema = z.object({ page: z.number().int().min(1), limit: z.number().int().min(1), total: z.number().int().min(0), totalPages: z.number().int().min(0) });
export const reportResponseSchema = z.object({ id: z.string().uuid(), type: z.enum(["availability", "performance", "alert_summary", "ai_narrative"]), title: z.string(), period: z.string().nullable(), content: z.record(z.unknown()).nullable(), aiSummary: z.string().nullable(), generatedBy: z.string().uuid().nullable(), generatedAt: z.string() });
export const reportListSchema = z.object({ data: z.array(reportResponseSchema.extend({ generatedByName: z.string().nullable().optional() })), pagination: paginationSchema });
export const notificationRecordSchema = z.object({ id: z.string().uuid(), incidentId: z.string().uuid().nullable(), channelId: z.string().uuid().nullable(), channelType: z.string(), status: z.string(), payload: z.record(z.unknown()).nullable(), error: z.string().nullable(), sentAt: z.string().nullable(), createdAt: z.string() }).passthrough();
export const notificationHistorySchema = z.object({ data: z.array(notificationRecordSchema), pagination: paginationSchema });
export const invitationResponseSchema = z.object({ invitation: z.object({ id: z.string().uuid(), token: z.string(), role: z.string(), scope: z.string(), email: z.string().nullable(), allowedDeviceIds: z.array(z.string().uuid()), allowedGroupIds: z.array(z.string().uuid()), expiresAt: z.string() }).passthrough(), inviteUrl: z.string().url() });
export const metricPointSchema = z.object({ time: z.string(), avg_value: z.number(), max_value: z.number(), min_value: z.number() });
export const metricSeriesSchema = z.object({ data: z.array(metricPointSchema) });
export const anomalyResponseSchema = z.object({ data: z.array(z.object({ value: z.number(), timestamp: z.string(), mean: z.number().nullable(), stddev: z.number().nullable(), is_anomaly: z.boolean() })) });
export const predictionResponseSchema = z.object({ prediction: z.object({ daysUntilThreshold: z.number(), slope: z.number(), currentAvg: z.number() }).nullable(), message: z.string().optional() });
export const aiQueryResponseSchema = z.union([
  z.object({ type: z.literal("data"), data: z.array(z.record(z.unknown())), columns: z.array(z.string()), sql: z.string(), explanation: z.string().optional() }),
  z.object({ type: z.literal("answer"), answer: z.string() }),
]);
