-- ===========================================
-- NetScopeNMS Database Schema
-- MySQL 8.0+
-- ===========================================

-- 데이터베이스 생성 (필요시)
-- CREATE DATABASE IF NOT EXISTS netscopenms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE netscopenms;

-- ===========================================
-- 1. 사용자 테이블
-- ===========================================
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user', 'viewer') NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 2. 장비 테이블
-- ===========================================
CREATE TABLE IF NOT EXISTS devices (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    device_type ENUM('router', 'switch', 'server', 'firewall', 'access_point', 'other') NOT NULL DEFAULT 'other',
    vendor VARCHAR(50) NULL COMMENT 'Cisco, Linux, Windows, etc.',
    model VARCHAR(100) NULL,
    location VARCHAR(200) NULL,
    description TEXT NULL,
    
    -- SNMP 기본 설정
    snmp_version ENUM('1', '2c', '3') NOT NULL DEFAULT '2c',
    snmp_port INT UNSIGNED NOT NULL DEFAULT 161,
    
    -- 폴링 설정
    poll_interval INT UNSIGNED NOT NULL DEFAULT 60 COMMENT 'seconds (60, 300, 600)',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- 상태 정보
    status ENUM('up', 'down', 'unknown', 'warning') NOT NULL DEFAULT 'unknown',
    last_poll_time DATETIME NULL,
    last_poll_success BOOLEAN NULL,
    
    -- 시스템 정보 (SNMP로 수집)
    sys_descr TEXT NULL,
    sys_name VARCHAR(255) NULL,
    sys_uptime BIGINT UNSIGNED NULL COMMENT 'timeticks',
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_devices_ip (ip_address),
    INDEX idx_devices_type (device_type),
    INDEX idx_devices_status (status),
    INDEX idx_devices_enabled (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 3. SNMP 인증 정보 테이블
-- ===========================================
CREATE TABLE IF NOT EXISTS snmp_credentials (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id INT UNSIGNED NOT NULL,
    
    -- SNMPv1/v2c
    community_string VARCHAR(255) NULL COMMENT 'encrypted',
    
    -- SNMPv3
    security_level ENUM('noAuthNoPriv', 'authNoPriv', 'authPriv') NULL,
    username VARCHAR(100) NULL,
    auth_protocol ENUM('MD5', 'SHA', 'SHA-256', 'SHA-384', 'SHA-512') NULL,
    auth_password VARCHAR(255) NULL COMMENT 'encrypted',
    priv_protocol ENUM('DES', 'AES', 'AES-128', 'AES-192', 'AES-256') NULL,
    priv_password VARCHAR(255) NULL COMMENT 'encrypted',
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_snmp_cred_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 4. 인터페이스 정보 테이블
-- ===========================================
CREATE TABLE IF NOT EXISTS interface_info (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id INT UNSIGNED NOT NULL,
    if_index INT UNSIGNED NOT NULL,
    if_descr VARCHAR(255) NULL,
    if_name VARCHAR(100) NULL,
    if_alias VARCHAR(255) NULL,
    if_type INT UNSIGNED NULL,
    if_speed BIGINT UNSIGNED NULL COMMENT 'bits per second',
    if_high_speed INT UNSIGNED NULL COMMENT 'Mbps for high-speed interfaces',
    if_phys_address VARCHAR(50) NULL COMMENT 'MAC address',
    if_admin_status ENUM('up', 'down', 'testing') NULL,
    if_oper_status ENUM('up', 'down', 'testing', 'unknown', 'dormant', 'notPresent', 'lowerLayerDown') NULL,
    is_monitored BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_interface_device_index (device_id, if_index),
    INDEX idx_interface_monitored (is_monitored)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 5. 메트릭 데이터 테이블 (30일 보관)
-- ===========================================
CREATE TABLE IF NOT EXISTS metrics (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id INT UNSIGNED NOT NULL,
    interface_id INT UNSIGNED NULL COMMENT 'NULL for device-level metrics',
    metric_type ENUM('cpu', 'memory', 'traffic_in', 'traffic_out', 'uptime', 'errors_in', 'errors_out', 'discards_in', 'discards_out', 'bandwidth_util', 'temperature', 'disk_usage', 'load_avg_1', 'load_avg_5', 'load_avg_15', 'swap_usage', 'fan_speed', 'power_status', 'process_count', 'tcp_connections') NOT NULL,
    value DOUBLE NOT NULL,
    unit VARCHAR(20) NULL COMMENT 'percent, bytes, bps, etc.',
    collected_at DATETIME NOT NULL,
    
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (interface_id) REFERENCES interface_info(id) ON DELETE CASCADE,
    
    INDEX idx_metrics_device_type_time (device_id, metric_type, collected_at),
    INDEX idx_metrics_collected_at (collected_at),
    INDEX idx_metrics_interface (interface_id, metric_type, collected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 6. 시간별 집계 테이블 (1년 보관)
-- ===========================================
CREATE TABLE IF NOT EXISTS metrics_hourly (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id INT UNSIGNED NOT NULL,
    interface_id INT UNSIGNED NULL,
    metric_type ENUM('cpu', 'memory', 'traffic_in', 'traffic_out', 'uptime', 'errors_in', 'errors_out', 'discards_in', 'discards_out', 'bandwidth_util', 'temperature', 'disk_usage', 'load_avg_1', 'load_avg_5', 'load_avg_15', 'swap_usage', 'fan_speed', 'power_status', 'process_count', 'tcp_connections') NOT NULL,
    hour_timestamp DATETIME NOT NULL COMMENT 'truncated to hour',
    avg_value DOUBLE NOT NULL,
    min_value DOUBLE NOT NULL,
    max_value DOUBLE NOT NULL,
    sample_count INT UNSIGNED NOT NULL,
    
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (interface_id) REFERENCES interface_info(id) ON DELETE CASCADE,
    
    UNIQUE INDEX idx_metrics_hourly_unique (device_id, interface_id, metric_type, hour_timestamp),
    INDEX idx_metrics_hourly_time (hour_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 7. 일별 집계 테이블 (3년 보관)
-- ===========================================
CREATE TABLE IF NOT EXISTS metrics_daily (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id INT UNSIGNED NOT NULL,
    interface_id INT UNSIGNED NULL,
    metric_type ENUM('cpu', 'memory', 'traffic_in', 'traffic_out', 'uptime', 'errors_in', 'errors_out', 'discards_in', 'discards_out', 'bandwidth_util', 'temperature', 'disk_usage', 'load_avg_1', 'load_avg_5', 'load_avg_15', 'swap_usage', 'fan_speed', 'power_status', 'process_count', 'tcp_connections') NOT NULL,
    day_timestamp DATE NOT NULL,
    avg_value DOUBLE NOT NULL,
    min_value DOUBLE NOT NULL,
    max_value DOUBLE NOT NULL,
    sample_count INT UNSIGNED NOT NULL,
    
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (interface_id) REFERENCES interface_info(id) ON DELETE CASCADE,
    
    UNIQUE INDEX idx_metrics_daily_unique (device_id, interface_id, metric_type, day_timestamp),
    INDEX idx_metrics_daily_time (day_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 8. 알람 규칙 테이블
-- ===========================================
CREATE TABLE IF NOT EXISTS alarm_rules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    metric_type ENUM('cpu', 'memory', 'traffic_in', 'traffic_out', 'uptime', 'errors_in', 'errors_out', 'discards_in', 'discards_out', 'bandwidth_util', 'temperature', 'disk_usage', 'load_avg_1', 'load_avg_5', 'load_avg_15', 'swap_usage', 'fan_speed', 'power_status', 'process_count', 'tcp_connections') NOT NULL,
    condition_operator ENUM('gt', 'gte', 'lt', 'lte', 'eq', 'neq') NOT NULL DEFAULT 'gt',
    threshold_warning DOUBLE NULL,
    threshold_critical DOUBLE NOT NULL,
    duration_seconds INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 means immediate',
    
    -- 적용 범위
    apply_to_all BOOLEAN NOT NULL DEFAULT TRUE,
    device_ids JSON NULL COMMENT 'specific device IDs if not apply_to_all',
    
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_alarm_rules_metric (metric_type),
    INDEX idx_alarm_rules_enabled (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 9. 알람 테이블
-- ===========================================
CREATE TABLE IF NOT EXISTS alarms (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id INT UNSIGNED NOT NULL,
    interface_id INT UNSIGNED NULL,
    rule_id INT UNSIGNED NULL,
    
    severity ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'warning',
    status ENUM('active', 'acknowledged', 'resolved') NOT NULL DEFAULT 'active',
    
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    
    metric_type ENUM('cpu', 'memory', 'traffic_in', 'traffic_out', 'uptime', 'errors_in', 'errors_out', 'discards_in', 'discards_out', 'bandwidth_util', 'connectivity') NULL,
    current_value DOUBLE NULL,
    threshold_value DOUBLE NULL,
    
    first_occurrence DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_occurrence DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    occurrence_count INT UNSIGNED NOT NULL DEFAULT 1,
    
    acknowledged_by INT UNSIGNED NULL,
    acknowledged_at DATETIME NULL,
    resolved_by INT UNSIGNED NULL,
    resolved_at DATETIME NULL,
    resolution_note TEXT NULL,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (interface_id) REFERENCES interface_info(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES alarm_rules(id) ON DELETE SET NULL,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_alarms_device (device_id),
    INDEX idx_alarms_status (status),
    INDEX idx_alarms_severity (severity),
    INDEX idx_alarms_created (created_at),
    INDEX idx_alarms_active (status, severity, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 10. AI 분석 결과 테이블
-- ===========================================
CREATE TABLE IF NOT EXISTS ai_analyses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id INT UNSIGNED NULL COMMENT 'NULL for global reports',
    alarm_id BIGINT UNSIGNED NULL,
    
    analysis_type ENUM('alarm_rca', 'prediction', 'daily_report', 'weekly_report', 'anomaly_detection') NOT NULL,
    
    -- AI 응답 저장
    prompt_summary VARCHAR(500) NULL COMMENT 'summary of what was sent to AI',
    result JSON NOT NULL,
    
    -- 메타데이터
    model_used VARCHAR(50) NULL,
    tokens_used INT UNSIGNED NULL,
    response_time_ms INT UNSIGNED NULL,
    
    -- 캐싱용
    cache_key VARCHAR(255) NULL,
    expires_at DATETIME NULL,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (alarm_id) REFERENCES alarms(id) ON DELETE CASCADE,
    
    INDEX idx_ai_analyses_device (device_id),
    INDEX idx_ai_analyses_type (analysis_type),
    INDEX idx_ai_analyses_created (created_at),
    INDEX idx_ai_analyses_cache (cache_key, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 11. 감사 로그 테이블 (선택사항)
-- ===========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================
-- 기본 데이터 삽입
-- ===========================================

-- 기본 관리자 계정 (password: admin123)
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@localhost', '$2b$10$YourHashedPasswordHere', 'admin')
ON DUPLICATE KEY UPDATE username = username;

-- 기본 알람 규칙
INSERT INTO alarm_rules (name, description, metric_type, condition_operator, threshold_warning, threshold_critical, duration_seconds) VALUES
('High CPU Usage', 'Alert when CPU usage exceeds threshold', 'cpu', 'gt', 70, 90, 300),
('High Memory Usage', 'Alert when memory usage exceeds threshold', 'memory', 'gt', 80, 95, 300),
('High Bandwidth Utilization', 'Alert when bandwidth utilization exceeds threshold', 'bandwidth_util', 'gt', 70, 90, 60),
('Interface Errors', 'Alert when interface errors exceed threshold', 'errors_in', 'gt', 10, 100, 60)
ON DUPLICATE KEY UPDATE name = name;

-- ===========================================
-- 이벤트 스케줄러 (자동 데이터 정리)
-- ===========================================

-- 이벤트 스케줄러 활성화 확인
-- SET GLOBAL event_scheduler = ON;

-- 30일 이상 된 raw 메트릭 삭제 (매일 자정 실행)
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_old_metrics
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 1 HOUR)
DO
BEGIN
    DELETE FROM metrics WHERE collected_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END//
DELIMITER ;

-- 1년 이상 된 시간별 메트릭 삭제
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_old_hourly_metrics
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 2 HOUR)
DO
BEGIN
    DELETE FROM metrics_hourly WHERE hour_timestamp < DATE_SUB(NOW(), INTERVAL 365 DAY);
END//
DELIMITER ;

-- 3년 이상 된 일별 메트릭 삭제
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_old_daily_metrics
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 3 HOUR)
DO
BEGIN
    DELETE FROM metrics_daily WHERE day_timestamp < DATE_SUB(NOW(), INTERVAL 1095 DAY);
END//
DELIMITER ;
