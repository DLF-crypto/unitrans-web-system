-- ============================================================================
-- 数据库完整迁移脚本
-- 整合了所有功能更新的数据库变更
-- 执行时间：2026年1月
-- ============================================================================

-- ============================================================================
-- 第一部分：轨迹管理系统 - 创建新表
-- ============================================================================

-- 1. 创建轨迹节点状态表
CREATE TABLE IF NOT EXISTS tracking_nodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status_code VARCHAR(32) NOT NULL UNIQUE COMMENT '状态代码',
    status_description VARCHAR(128) NOT NULL COMMENT '状态说明',
    default_city VARCHAR(64) COMMENT '默认城市',
    default_country_code VARCHAR(3) COMMENT '默认国家代码（如：CN、US）',
    default_airport_code VARCHAR(3) COMMENT '默认机场三字代码（如：PVG、LAX）',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status_code (status_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='轨迹节点状态管理';

-- 2. 创建轨迹接口表
CREATE TABLE IF NOT EXISTS tracking_interfaces (
    id INT AUTO_INCREMENT PRIMARY KEY,
    interface_name VARCHAR(128) NOT NULL UNIQUE COMMENT '轨迹接口名称',
    request_url VARCHAR(512) NOT NULL COMMENT '轨迹请求地址',
    auth_params TEXT COMMENT '轨迹接口验证信息(JSON格式)',
    status_mapping TEXT COMMENT '状态映射表(JSON格式)',
    fetch_interval DECIMAL(5,2) NOT NULL COMMENT '获取频率(小时)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_interface_name (interface_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='轨迹接口管理';

-- 3. 创建轨迹信息表
CREATE TABLE IF NOT EXISTS tracking_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    waybill_id INT NOT NULL COMMENT '运单ID',
    order_no VARCHAR(64) NOT NULL COMMENT '订单号',
    transfer_no VARCHAR(64) COMMENT '转单号',
    tracking_interface_id INT NOT NULL COMMENT '轨迹接口ID',
    tracking_description TEXT COMMENT '轨迹描述',
    status_code VARCHAR(32) COMMENT '轨迹状态代码(系统状态代码)',
    tracking_time DATETIME COMMENT '时间节点',
    last_fetch_time DATETIME COMMENT '最新获取时间(从供应商接口获取)',
    last_push_time DATETIME COMMENT '最新推送时间(推送到上家)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_waybill_id (waybill_id),
    INDEX idx_order_no (order_no),
    INDEX idx_transfer_no (transfer_no),
    FOREIGN KEY (waybill_id) REFERENCES waybills(id) ON DELETE CASCADE,
    FOREIGN KEY (tracking_interface_id) REFERENCES tracking_interfaces(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='轨迹信息存储';

-- ============================================================================
-- 第二部分：产品表扩展 - 添加供应商和轨迹接口关联
-- ============================================================================

-- 4. 为产品表添加供应商字段（用于差价收费产品）
ALTER TABLE products ADD COLUMN supplier_id INT COMMENT '绑定的供应商ID(仅当有差价收费时)';

-- 5. 为产品表添加轨迹接口字段（用于尾程收费产品）
ALTER TABLE products ADD COLUMN tracking_interface_id INT COMMENT '绑定的轨迹接口ID(仅当有尾程收费时)';

-- 6. 添加外键约束
-- 注：如果约束已存在，会报错，可忽略
ALTER TABLE products ADD CONSTRAINT fk_products_supplier_id 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE products ADD CONSTRAINT fk_products_tracking_interface_id 
    FOREIGN KEY (tracking_interface_id) REFERENCES tracking_interfaces(id) ON DELETE SET NULL;

-- ============================================================================
-- 第三部分：轨迹信息表扩展 - 添加原始报文和停止跟踪字段
-- ============================================================================

-- 7. 添加接口原始报文字段
ALTER TABLE tracking_info ADD COLUMN raw_response TEXT COMMENT '接口原始报文(JSON格式)';

-- 8. 添加停止跟踪相关字段
ALTER TABLE tracking_info ADD COLUMN stop_tracking BOOLEAN DEFAULT FALSE COMMENT '是否停止自动跟踪';
ALTER TABLE tracking_info ADD COLUMN stop_tracking_reason VARCHAR(255) COMMENT '停止跟踪原因';
ALTER TABLE tracking_info ADD COLUMN stop_tracking_time DATETIME COMMENT '停止跟踪时间';

-- 9. 添加尾程轨迹相关字段
ALTER TABLE tracking_info ADD COLUMN lastmile_no VARCHAR(64) COMMENT '尾程单号';
ALTER TABLE tracking_info ADD INDEX idx_lastmile_no (lastmile_no);
ALTER TABLE tracking_info ADD COLUMN lastmile_raw_response TEXT COMMENT '尾程接口原始报文(JSON格式)，兼容字段';
ALTER TABLE tracking_info ADD COLUMN lastmile_last_fetch_time DATETIME COMMENT '尾程最新获取时间';
ALTER TABLE tracking_info ADD COLUMN lastmile_register_response LONGTEXT COMMENT '尾程注册报文(JSON格式)';
ALTER TABLE tracking_info ADD COLUMN lastmile_tracking_response LONGTEXT COMMENT '尾程单号报文(JSON格式)';

-- 10. 扩大尾程报文字段长度（如果字段已存在为TEXT类型，需要修改为LONGTEXT）
-- 原因：17Track批量返回的轨迹数据超过TEXT(64KB)限制，实际数据可达145KB
ALTER TABLE tracking_info MODIFY COLUMN lastmile_register_response LONGTEXT COMMENT '尾程注册报文(JSON格式)';
ALTER TABLE tracking_info MODIFY COLUMN lastmile_tracking_response LONGTEXT COMMENT '尾程单号报文(JSON格式)';

-- 11. 添加推送报文字段（用于深邮接口推送）
ALTER TABLE tracking_info ADD COLUMN push_events LONGTEXT COMMENT '推送报文(JSON格式，存储所有轨迹节点事件)';

-- 12. 添加深邮响应报文字段
ALTER TABLE tracking_info ADD COLUMN szpost_response LONGTEXT COMMENT '深邮响应报文(JSON格式)';

-- 13. 添加轨迹接口表新字段（关键信息代码参数）
ALTER TABLE tracking_interfaces ADD COLUMN response_key_params TEXT COMMENT '关键信息代码参数，JSON格式：{"time_key":"changeDate","status_key":"status","description_key":"record","city_key":"city","country_key":"country"}';
ALTER TABLE tracking_interfaces MODIFY COLUMN status_mapping TEXT COMMENT '头程状态映射表，JSON格式：[{"supplier_status":"xxx","supplier_description":"","system_status_code":"xxx"},...]';

-- ============================================================================
-- 第四部分：尾程轨迹状态映射表（独立表）
-- ============================================================================

-- 14. 创建独立的尾程轨迹状态映射表
CREATE TABLE IF NOT EXISTS lastmile_status_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    description VARCHAR(255) DEFAULT '' COMMENT '尾程轨迹描述（对应报文的description字段，非必填）',
    sub_status VARCHAR(64) NOT NULL COMMENT '尾程轨迹状态（对应报文的sub_status字段）',
    system_status_code VARCHAR(32) NOT NULL COMMENT '系统状态代码',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_description (description),
    INDEX idx_sub_status (sub_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='尾程轨迹状态映射表';

-- ============================================================================
-- 迁移说明
-- ============================================================================
-- 
-- 本迁移脚本包含以下功能更新：
--
-- 1. 轨迹管理系统（tracking_nodes, tracking_interfaces, tracking_info表）
--    - 支持多个轨迹接口管理
--    - 支持状态映射和自动转换
--    - 支持定时自动获取轨迹
--
-- 2. 产品表扩展（products表）
--    - 添加supplier_id：绑定差价收费产品的供应商
--    - 添加tracking_interface_id：绑定尾程收费产品的轨迹接口
--
-- 3. 轨迹信息表扩展（tracking_info表）
--    - 添加raw_response：存储接口原始报文用于调试
--    - 添加stop_tracking相关字段：支持自动停止跟踪功能
--      * 运单导入系统超过45天自动停止
--      * 运单状态代码为O_016自动停止
--      * 运单停止更新超过20天自动停止
--    - 添加尾程轨迹相关字段：支持17Track尾程轨迹
--      * lastmile_register_response/lastmile_tracking_response使用LONGTEXT类型
--      * 原因：17Track批量返嘞62个单号的轨迹数据可达145KB，超过TEXT(64KB)限制
--
-- 4. 尾程轨迹状态映射表（lastmile_status_mappings表）
--    - 创建独立的映射表，支持description非必填
--    - description为空时直接匹配sub_status，非空时优先匹配description
--
-- 执行建议：
-- 1. 在生产环境执行前，请先在测试环境验证
-- 2. 建议在低峰期执行，避免影响业务
-- 3. 执行前请做好数据库备份
-- 4. ALTER TABLE 命令不支持 IF NOT EXISTS，如字段已存在会报错，可忽略
-- 5. CREATE TABLE 命令支持 IF NOT EXISTS，可安全重复执行
--
-- ============================================================================
