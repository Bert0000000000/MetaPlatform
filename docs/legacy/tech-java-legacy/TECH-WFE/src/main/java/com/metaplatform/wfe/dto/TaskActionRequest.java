package com.metaplatform.wfe.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TaskActionRequest {

    @NotBlank(message = "审批操作类型不能为空")
    private String action;

    private String comment;

    private String transferTo;
}
