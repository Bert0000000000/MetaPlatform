package com.metaplatform.wfe.taskoperation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UrgeRequest {

    @NotBlank(message = "urgedUser 不能为空")
    private String urgedUser;

    private String message;
}