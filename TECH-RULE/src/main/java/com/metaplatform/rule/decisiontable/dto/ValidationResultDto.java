package com.metaplatform.rule.decisiontable.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidationResultDto {

    private boolean valid;
    private int totalRows;
    private int validRows;
    private int invalidRows;
    private List<RowValidationError> errors;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RowValidationError {
        private String rowId;
        private Integer rowOrder;
        private String field;
        private String message;
    }
}
