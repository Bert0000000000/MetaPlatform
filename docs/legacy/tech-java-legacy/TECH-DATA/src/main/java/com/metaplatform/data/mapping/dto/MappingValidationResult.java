package com.metaplatform.data.mapping.dto;

import java.util.List;

/**
 * 映射校验结果。
 */
public record MappingValidationResult(
        boolean valid,
        int totalFields,
        int validFields,
        int invalidFields,
        List<FieldValidationIssue> issues
) {
    public record FieldValidationIssue(
            String fieldId,
            String sourceField,
            String ontologyAttribute,
            String sourceType,
            String targetType,
            String reason
    ) {
    }
}
