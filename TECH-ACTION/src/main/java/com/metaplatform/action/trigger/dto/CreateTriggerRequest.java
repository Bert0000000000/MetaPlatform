package com.metaplatform.action.trigger.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateTriggerRequest {

    @NotBlank(message = "actionId 不能为空")
    private String actionId;

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotNull(message = "triggerType 不能为空")
    private String triggerType;

    private String eventTopic;

    private String cronExpression;

    private String config;
}
