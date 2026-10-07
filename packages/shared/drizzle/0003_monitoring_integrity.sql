CREATE TABLE "alert_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"first_failure_at" timestamp with time zone,
	"last_evaluated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "alert_evaluations_device_rule_unique" UNIQUE("device_id","rule_id")
);
--> statement-breakpoint
CREATE TABLE "migration_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_table" varchar(100) NOT NULL,
	"source_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"data" jsonb NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topology_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_device_id" uuid NOT NULL,
	"target_device_id" uuid NOT NULL,
	"source_port" varchar(255) DEFAULT '' NOT NULL,
	"target_port" varchar(255),
	"discovery_method" varchar(20) DEFAULT 'manual' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topology_edges_connection_unique" UNIQUE("source_device_id","target_device_id","source_port")
);
--> statement-breakpoint
ALTER TABLE "maintenance_windows" ADD COLUMN "timezone" varchar(100) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedup_key" varchar(255);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_evaluations" ADD CONSTRAINT "alert_evaluations_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_evaluations" ADD CONSTRAINT "alert_evaluations_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topology_edges" ADD CONSTRAINT "topology_edges_source_device_id_devices_id_fk" FOREIGN KEY ("source_device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topology_edges" ADD CONSTRAINT "topology_edges_target_device_id_devices_id_fk" FOREIGN KEY ("target_device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Preserve superseded records before enforcing uniqueness on upgrades.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY device_id, rule_id ORDER BY started_at, id) AS rank
  FROM incidents WHERE status <> 'resolved' AND rule_id IS NOT NULL
), archived AS (
  INSERT INTO migration_archives (source_table, source_id, reason, data)
  SELECT 'incidents', i.id, 'Duplicate active incident consolidated', to_jsonb(i)
  FROM incidents i JOIN ranked r ON r.id = i.id WHERE r.rank > 1 RETURNING source_id
)
UPDATE incidents SET status = 'resolved', resolved_at = COALESCE(resolved_at, NOW()), updated_at = NOW()
WHERE id IN (SELECT source_id FROM archived);
--> statement-breakpoint
INSERT INTO incident_events (incident_id, type, message)
SELECT source_id, 'resolved', 'Duplicate consolidated during monitoring integrity migration; original data archived'
FROM migration_archives WHERE source_table = 'incidents';
--> statement-breakpoint
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY device_id, if_index ORDER BY last_updated_at DESC NULLS LAST, created_at DESC, id) AS rank
  FROM interfaces
), archived AS (
  INSERT INTO migration_archives (source_table, source_id, reason, data)
  SELECT 'interfaces', i.id, 'Duplicate interface index consolidated', to_jsonb(i)
  FROM interfaces i JOIN ranked r ON r.id = i.id WHERE r.rank > 1 RETURNING source_id
)
DELETE FROM interfaces WHERE id IN (SELECT source_id FROM archived);
--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_active_rule_device_unique" ON "incidents" USING btree ("device_id","rule_id") WHERE "incidents"."status" <> 'resolved' AND "incidents"."rule_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "interfaces" ADD CONSTRAINT "interfaces_device_index_unique" UNIQUE("device_id","if_index");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_dedup_key_unique" UNIQUE("dedup_key");