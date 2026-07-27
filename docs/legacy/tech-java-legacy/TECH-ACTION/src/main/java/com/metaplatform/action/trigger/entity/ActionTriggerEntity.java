package com.metaplatform.action.trigger.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;
import java.time.Instant;

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
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "trigger_id", nullable = false, length = 64)
    private String triggerId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "action_id", nullable = false, length = 64)
    private String actionId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "trigger_type", nullable = false, length = 20)
    private String triggerType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "event_topic", length = 256)
    private String eventTopic;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "cron_expression", length = 128)
    private String cronExpression;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config", columnDefinition = "jsonb")
    private Map<String, Object> config;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

}
