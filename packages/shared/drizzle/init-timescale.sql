-- NetPulse Database Initialization
-- Run after Drizzle migrations to set up TimescaleDB and seed data

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert metrics table to hypertable
SELECT create_hypertable('metrics', 'timestamp', if_not_exists => TRUE);

-- Create compression policy (compress data older than 7 days)
ALTER TABLE metrics SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id,metric_name'
);
SELECT add_compression_policy('metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- Create retention policy (drop data older than 365 days)
SELECT add_retention_policy('metrics', INTERVAL '365 days', if_not_exists => TRUE);

-- Create continuous aggregates for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
  device_id,
  metric_name,
  time_bucket('1 hour', timestamp) AS bucket,
  AVG(value) AS avg_value,
  MAX(value) AS max_value,
  MIN(value) AS min_value,
  COUNT(*) AS sample_count
FROM metrics
GROUP BY device_id, metric_name, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('metrics_hourly',
  start_offset => INTERVAL '2 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_metrics_device_time ON metrics (device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON metrics (metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_device ON incidents (device_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status, severity);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices (status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id, created_at DESC);
