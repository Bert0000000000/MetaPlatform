package com.metaplatform.action.trigger.dto;

import lombok.Data;

@Data
public class UpdateTriggerRequest {

    private String name;
    private String triggerType;
    private String eventTopic;
    private String cronExpression;
    private String config;
}
