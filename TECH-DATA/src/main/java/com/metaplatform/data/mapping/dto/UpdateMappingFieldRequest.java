package com.metaplatform.data.mapping.dto;

import jakarta.validation.constraints.Size;

/**
 * 更新字段映射请求（所有字段可选，null 表示不更新）。
 */
public record UpdateMappingFieldRequest(
        @Size(max = 256, message = "sourceField 最长 256 字符")
        String sourceField,

        @Size(max = 64, message = "sourceType 最长 64 字符")
        String sourceType,

        @Size(max = 256, message = "ontologyAttribute 最长 256 字符")
        String ontologyAttribute,

        @Size(max = 64, message = "targetType 最长 64 字符")
        String targetType,

        @Size(max = 1024, message = "transformExpression 最长 1024 字符")
        String transformExpression,

        Boolean isRequired
) {
}
