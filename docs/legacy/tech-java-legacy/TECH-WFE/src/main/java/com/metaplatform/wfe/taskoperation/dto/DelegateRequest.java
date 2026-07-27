package com.metaplatform.wfe.taskoperation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DelegateRequest {

    @NotBlank(message = "toUser 不能为空")
    private String toUser;

    private String reason;
}