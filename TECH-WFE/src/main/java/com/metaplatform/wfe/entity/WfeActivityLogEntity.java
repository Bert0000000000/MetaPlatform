package com.metaplatform.wfe.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "wfe_activity_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WfeActivityLogEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "process_instance_id", nullable = false, length = 64)
    private String processInstanceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "task_id", length = 64)
    private String taskId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "node_id", nullable = false, length = 128)
    private String nodeId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "node_type", nullable = false, length = 64)
    private String nodeType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "activity_type", length = 64)
    private String activityType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "assignee", length = 64)
    private String assignee;

    @Column(name = "entered_at", nullable = false)
    private Instant enteredAt;

    @Column(name = "exited_at")
    private Instant exitedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;

}
