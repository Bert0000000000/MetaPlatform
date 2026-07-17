package com.metaplatform.wfe.taskoperation.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "wfe_event_subscription")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventSubscriptionEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "event_types", nullable = false, columnDefinition = "jsonb")
    private String eventTypes;

    @Column(name = "callback_url", nullable = false, length = 2048)
    private String callbackUrl;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}