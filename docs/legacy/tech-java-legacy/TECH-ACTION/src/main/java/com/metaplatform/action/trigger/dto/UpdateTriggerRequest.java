package com.metaplatform.action.trigger.dto;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateTriggerRequest {

    private String name;
    private String triggerType;
    private String eventTopic;
    private String cronExpression;
    private Map<String, Object> config;
}