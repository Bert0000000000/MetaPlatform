package com.metaplatform.dialogue.domain.intent;

/**
 * 意图类别枚举。涵盖平台常见操作意图。
 */
public enum IntentCategory {
    /** 查询信息 */
    QUERY,
    /** 创建记录 */
    CREATE,
    /** 更新记录 */
    UPDATE,
    /** 删除记录 */
    DELETE,
    /** 导出数据 */
    EXPORT,
    /** 导入数据 */
    IMPORT,
    /** 系统操作 */
    SYSTEM,
    /** 帮助请求 */
    HELP,
    /** 确认操作 */
    CONFIRM,
    /** 取消操作 */
    CANCEL,
    /** 未知意图 */
    UNKNOWN
}
