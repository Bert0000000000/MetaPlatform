package com.metaplatform.data.mapping.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 添加字段映射请求。
 */
public record CreateMappingFieldRequest(
        @NotBlank(message = "sourceField 不能为空")
        @Size(max = 256, message = "sourceField 最长 256 字符")
        String sourceField,

        @NotBlank(message = "sourceType 不能为空")
        @Size(max = 64, message = "sourceType 最长 64 字符")
        String sourceType,

        @NotBlank(message = "ontologyAttribute 不能为空")
        @Size(max = 256, message = "ontologyAttribute 最长 256 字符")
        String ontologyAttribute,

        @NotBlank(message = "targetType 不能为空")
        @Size(max = 64, message = "targetType 最长 64 字符")
        String targetType,

        @Size(max = 1024, message = "transformExpression 最长 1024 字符")
        String transformExpression,

        Boolean isRequired
) {
}
