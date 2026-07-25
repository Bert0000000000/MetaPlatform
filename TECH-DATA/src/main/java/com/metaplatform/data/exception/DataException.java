package com.metaplatform.data.exception;

import com.metaplatform.data.common.ErrorCode;
import lombok.Getter;

/**
 * TECH-DATA 业务异常基类。
 *
 * <p>携带 {@link ErrorCode} 与自定义 message，由 {@link GlobalExceptionHandler}
 * 统一翻译为 HTTP 响应。Service 层抛出此异常（或其子类）即可。</p>
 */
@Getter
public class DataException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** 业务错误码。 */
    private final ErrorCode errorCode;

    /**
     * 以错误码 + 默认 message 构造。
     */
    public DataException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    /**
     * 以错误码 + 自定义 message 构造。
     */
    public DataException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    /**
     * 以错误码 + 自定义 message + 原因构造。
     */
    public DataException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    /**
     * 便捷工厂：参数错误。
     */
    public static DataException invalidParam(String message) {
        return new DataException(ErrorCode.INVALID_PARAM, message);
    }

    /**
     * 便捷工厂：数据源不存在。
     */
    public static DataException datasourceNotFound(String datasourceId) {
        return new DataException(ErrorCode.DATASOURCE_NOT_FOUND, "数据源不存在: " + datasourceId);
    }

    /**
     * 便捷工厂：Schema 不存在。
     */
    public static DataException schemaNotFound(String schemaKey) {
        return new DataException(ErrorCode.SCHEMA_NOT_FOUND, "Schema 不存在: " + schemaKey);
    }

    /**
     * 便捷工厂：查询记录不存在。
     */
    public static DataException queryNotFound(String queryId) {
        return new DataException(ErrorCode.QUERY_NOT_FOUND, "查询记录不存在: " + queryId);
    }

    /**
     * 便捷工厂：数据源名称重复。
     */
    public static DataException datasourceNameDuplicate(String name) {
        return new DataException(ErrorCode.DATASOURCE_NAME_DUPLICATE, "数据源名称已存在: " + name);
    }

    /**
     * 便捷工厂：连接测试失败。
     */
    public static DataException connectionTestFailed(String message) {
        return new DataException(ErrorCode.CONNECTION_TEST_FAILED, message);
    }

    /**
     * 便捷工厂：Schema 发现失败。
     */
    public static DataException schemaDiscoveryFailed(String message) {
        return new DataException(ErrorCode.SCHEMA_DISCOVERY_FAILED, message);
    }

    /**
     * 便捷工厂：不支持的数据源类型。
     */
    public static DataException unsupportedSourceType(String sourceType) {
        return new DataException(ErrorCode.UNSUPPORTED_SOURCE_TYPE, "不支持的数据源类型: " + sourceType);
    }

    /**
     * 便捷工厂：数据映射不存在。
     */
    public static DataException mappingNotFound(String mappingId) {
        return new DataException(ErrorCode.DATA_MAPPING_NOT_FOUND, "数据映射不存在: " + mappingId);
    }

    /**
     * 便捷工厂：字段映射不存在。
     */
    public static DataException mappingFieldNotFound(String fieldId) {
        return new DataException(ErrorCode.MAPPING_FIELD_NOT_FOUND, "字段映射不存在: " + fieldId);
    }

    /**
     * 便捷工厂：数据映射名称重复。
     */
    public static DataException mappingNameDuplicate(String name) {
        return new DataException(ErrorCode.DATA_MAPPING_NAME_DUPLICATE, "数据映射名称已存在: " + name);
    }

    /**
     * 便捷工厂：映射校验失败。
     */
    public static DataException mappingValidationFailed(String message) {
        return new DataException(ErrorCode.MAPPING_VALIDATION_FAILED, message);
    }

    /**
     * 便捷工厂：映射执行失败。
     */
    public static DataException mappingExecutionFailed(String message) {
        return new DataException(ErrorCode.MAPPING_EXECUTION_FAILED, message);
    }
}
