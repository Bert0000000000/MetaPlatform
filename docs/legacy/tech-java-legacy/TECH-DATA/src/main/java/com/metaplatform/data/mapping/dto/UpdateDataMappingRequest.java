package com.metaplatform.data.mapping.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 更新数据映射请求（所有字段可选，null 表示不更新）。
 */
public record UpdateDataMappingRequest(
        @Size(max = 128, message = "名称最长 128 字符")
        String name,

        @Size(max = 1024, message = "描述最长 1024 字符")
        String description,

        @Pattern(regexp = "DRAFT|ACTIVE|INACTIVE", message = "status 只能为 DRAFT/ACTIVE/INACTIVE")
        String status,

        @Pattern(regexp = "MANUAL|SCHEDULED|REALTIME", message = "syncMode 只能为 MANUAL/SCHEDULED/REALTIME")
        String syncMode,

        String cronExpression
) {
}
