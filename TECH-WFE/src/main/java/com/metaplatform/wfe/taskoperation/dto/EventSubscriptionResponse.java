package com.metaplatform.wfe.taskoperation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventSubscriptionResponse {

    private String id;
    private String userId;
    private List<String> eventTypes;
    private String callbackUrl;
    private Boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;
}