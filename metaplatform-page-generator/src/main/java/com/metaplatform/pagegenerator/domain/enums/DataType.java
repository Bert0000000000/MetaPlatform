package com.metaplatform.pagegenerator.domain.enums;

/**
 * 字段数据类型枚举 - 用于 FieldSemanticRecognizer 的类型推断
 */
public enum DataType {
    STRING,
    INTEGER,
    LONG,
    BIG_DECIMAL,
    DOUBLE,
    BOOLEAN,
    LOCAL_DATE,
    LOCAL_DATE_TIME,
    LOCAL_TIME,
    INSTANT,
    ENUM,
    REFERENCE,
    JSON
}
