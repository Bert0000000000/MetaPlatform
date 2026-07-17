package com.metaplatform.action.trigger.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TriggerResponse {

    private String triggerId;
    private String actionId;
    private String name;
    private String triggerType;
    private String eventTopic;
    private String cronExpression;
    private String config;
    private Boolean enabled;
    private String createdBy;
    private String updatedBy;
    private Instant createdAt;
    private Instant updatedAt;
}
