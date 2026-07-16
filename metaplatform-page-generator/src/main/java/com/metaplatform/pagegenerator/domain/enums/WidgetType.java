package com.metaplatform.pagegenerator.domain.enums;

/**
 * 组件类型枚举 - 覆盖所有前端 UI 组件
 */
public enum WidgetType {
    // 文本类
    TEXT, TEXTAREA, RICH_TEXT,
    // 数值类
    NUMBER, CURRENCY, PERCENTAGE,
    // 选择类
    SELECT, MULTI_SELECT, RADIO, CHECKBOX,
    // 日期类
    DATE, DATE_TIME, TIME,
    // 特殊类
    EMAIL, PHONE, URL, COLOR, FILE_UPLOAD, IMAGE_UPLOAD,
    // 关系类
    LOOKUP, MASTER_DETAIL,
    // 布局类
    DIVIDER, SECTION_HEADER
}
