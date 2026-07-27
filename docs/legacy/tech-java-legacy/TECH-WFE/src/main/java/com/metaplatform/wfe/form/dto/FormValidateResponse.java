package com.metaplatform.wfe.form.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class FormValidateResponse {

    private boolean valid;

    private List<FormValidationError> errors;
}
