package com.metaplatform.obs.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class NotificationSettingsEntity {

    private String id;
    private String tenantId;
    private String userId;
    private boolean approval;
    private boolean task;
    private boolean system;
    private boolean mention;
    private boolean alert;
    private boolean email;
    private boolean push;
    private Instant createdAt;
    private Instant updatedAt;
}
