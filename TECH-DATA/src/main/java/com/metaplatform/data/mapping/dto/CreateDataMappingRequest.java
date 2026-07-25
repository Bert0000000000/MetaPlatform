package com.metaplatform.data.mapping.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 创建数据映射请求。
 */
public record CreateDataMappingRequest(
        @NotBlank(message = "名称不能为空")
        @Size(max = 128, message = "名称最长 128 字符")
        String name,

        @Size(max = 1024, message = "描述最长 1024 字符")
        String description,

        @NotBlank(message = "datasourceId 不能为空")
        String datasourceId,

        @NotBlank(message = "sourceTable 不能为空")
        String sourceTable,

        @NotBlank(message = "ontologyEntityId 不能为空")
        String ontologyEntityId,

        @Pattern(regexp = "DRAFT|ACTIVE|INACTIVE", message = "status 只能为 DRAFT/ACTIVE/INACTIVE")
        String status,

        @Pattern(regexp = "MANUAL|SCHEDULED|REALTIME", message = "syncMode 只能为 MANUAL/SCHEDULED/REALTIME")
        String syncMode,

        String cronExpression
) {
}
