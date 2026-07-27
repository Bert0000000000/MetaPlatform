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
public class TriggerListItem {

    private String triggerId;
    private String actionId;
    private String name;
    private String triggerType;
    private Boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;
}
