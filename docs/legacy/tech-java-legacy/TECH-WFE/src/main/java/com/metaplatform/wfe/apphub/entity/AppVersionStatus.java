package com.metaplatform.wfe.apphub.entity;

/**
 * 应用版本状态枚举（V11-08）：
 *   DRAFT     - 草稿
 *   PUBLISHED - 已发布
 *   OFFLINE   - 已下线
 *   ROLLBACK  - 由回滚操作创建的版本
 */
public enum AppVersionStatus {
    DRAFT,
    PUBLISHED,
    OFFLINE,
    ROLLBACK
}
