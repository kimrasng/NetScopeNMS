import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
export function bodySchema(schema: ZodTypeAny) { return { body: zodToJsonSchema(schema, { $refStrategy: "none" }) }; }

import { reportListSchema, reportResponseSchema, notificationHistorySchema, invitationResponseSchema, metricSeriesSchema, anomalyResponseSchema, predictionResponseSchema, aiQueryResponseSchema } from "@netpulse/shared/contracts";
export const responseContracts = new Map<string, ZodTypeAny>([
  ["GET /api/reports", reportListSchema], ["POST /api/reports/generate", reportResponseSchema],
  ["GET /api/notifications/history", notificationHistorySchema], ["POST /api/setup/invite", invitationResponseSchema],
  ["GET /api/metrics", metricSeriesSchema], ["GET /api/metrics/anomalies", anomalyResponseSchema], ["GET /api/metrics/predict", predictionResponseSchema],
  ["POST /api/ai/query", aiQueryResponseSchema],
]);
