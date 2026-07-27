package com.metaplatform.wfe.form.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FormValidationError {

    private String fieldKey;

    private String code;

    private String message;
}
