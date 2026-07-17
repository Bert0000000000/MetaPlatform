package com.metaplatform.action.trigger.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "action_trigger")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActionTriggerEntity {

    public static final String TYPE_EVENT = "EVENT";
    public static final String TYPE_SCHEDULE = "SCHEDULE";
    public static final String TYPE_MANUAL = "MANUAL";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "trigger_id", nullable = false, length = 64)
    private String triggerId;

    @Column(name = "action_id", nullable = false, length = 64)
    private String actionId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(name = "trigger_type", nullable = false, length = 20)
    private String triggerType;

    @Column(name = "event_topic", length = 256)
    private String eventTopic;

    @Column(name = "cron_expression", length = 128)
    private String cronExpression;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "jsonb")
    private String config;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
