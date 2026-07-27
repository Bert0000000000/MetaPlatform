package com.metaplatform.data.common;

import lombok.Getter;

/**
 * TECH-DATA 业务错误码枚举。
 *
 * <p>错误码与 HTTP 状态一一对应，由 {@link com.metaplatform.data.exception.GlobalExceptionHandler}
 * 统一翻译为 HTTP 响应。</p>
 */
@Getter
public enum ErrorCode {

    SUCCESS(0, 200, "success"),

    // 4xx 客户端错误
    INVALID_PARAM(40001, 400, "无效参数"),
    MISSING_REQUIRED_FIELD(40003, 400, "缺少必填字段"),
    INVALID_FIELD_VALUE(40004, 400, "字段值无效"),
    UNSUPPORTED_SOURCE_TYPE(40007, 400, "不支持的数据源类型"),
    TENANT_MISMATCH(40302, 403, "租户不匹配"),
    DATASOURCE_NOT_FOUND(40401, 404, "数据源不存在"),
    SCHEMA_NOT_FOUND(40402, 404, "Schema 不存在"),
    QUERY_NOT_FOUND(40403, 404, "查询记录不存在"),

    // 资源不存在（404）
    ETL_TASK_NOT_FOUND(40404, 404, "ETL 任务不存在"),
    LAKE_TABLE_NOT_FOUND(40405, 404, "数据湖表不存在"),
    WAREHOUSE_TABLE_NOT_FOUND(40406, 404, "数仓表不存在"),
    CATALOG_ASSET_NOT_FOUND(40407, 404, "数据资产不存在"),
    QUALITY_RULE_NOT_FOUND(40408, 404, "质量规则不存在"),
    DBT_PROJECT_NOT_FOUND(40409, 404, "DBT 项目不存在"),
    ALERT_NOT_FOUND(40410, 404, "告警不存在"),
    DATA_MAPPING_NOT_FOUND(40411, 404, "数据映射不存在"),
    MAPPING_FIELD_NOT_FOUND(40412, 404, "字段映射不存在"),

    // 业务冲突（409）
    DATASOURCE_NAME_DUPLICATE(40901, 409, "数据源名称已存在"),
    ETL_TASK_NAME_DUPLICATE(40902, 409, "ETL 任务名称已存在"),
    LAKE_TABLE_DUPLICATE(40903, 409, "数据湖表已存在"),
    WAREHOUSE_TABLE_DUPLICATE(40904, 409, "数仓表已存在"),
    CATALOG_ASSET_DUPLICATE(40905, 409, "数据资产已存在"),
    DBT_PROJECT_DUPLICATE(40906, 409, "DBT 项目已存在"),
    DATA_MAPPING_NAME_DUPLICATE(40907, 409, "数据映射名称已存在"),

    // 业务执行失败（422）
    CONNECTION_TEST_FAILED(42201, 422, "连接测试失败"),
    SCHEMA_DISCOVERY_FAILED(42202, 422, "Schema 发现失败"),
    MAPPING_VALIDATION_FAILED(42203, 422, "映射校验失败"),

    // 5xx 服务端错误
    INTERNAL_ERROR(50001, 500, "服务内部错误"),
    DATA_SOURCE_ERROR(50006, 500, "数据源错误"),
    ETL_EXECUTION_FAILED(50007, 500, "ETL 执行失败"),
    QUALITY_CHECK_FAILED(50008, 500, "质量检查执行失败"),
    NEO4J_QUERY_FAILED(50009, 500, "Neo4j 查询失败"),
    MINIO_OPERATION_FAILED(50010, 500, "MinIO 操作失败"),
    FLINK_JOB_FAILED(50011, 500, "Flink 作业失败"),
    MAPPING_EXECUTION_FAILED(50012, 500, "数据映射执行失败");

    private final int code;
    private final int httpStatus;
    private final String defaultMessage;

    ErrorCode(int code, int httpStatus, String defaultMessage) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }
}
