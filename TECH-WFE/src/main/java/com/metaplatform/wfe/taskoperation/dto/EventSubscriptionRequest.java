package com.metaplatform.wfe.taskoperation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class EventSubscriptionRequest {

    @NotEmpty(message = "eventTypes 不能为空")
    private List<String> eventTypes;

    @NotBlank(message = "callbackUrl 不能为空")
    private String callbackUrl;

    private Boolean enabled;
}