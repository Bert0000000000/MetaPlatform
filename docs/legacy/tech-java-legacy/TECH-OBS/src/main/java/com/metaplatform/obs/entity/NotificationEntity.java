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
public class NotificationEntity {

    private String id;
    private String tenantId;
    private String userId;
    private String type;
    private String title;
    private String content;
    private boolean read;
    private String link;
    private Instant createdAt;
}
