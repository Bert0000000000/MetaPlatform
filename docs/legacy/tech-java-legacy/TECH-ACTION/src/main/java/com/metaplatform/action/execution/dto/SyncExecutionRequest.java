package com.metaplatform.action.execution.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SyncExecutionRequest {

    @NotBlank(message = "actionCode 不能为空")
    private String actionCode;

    private Object input;
}
