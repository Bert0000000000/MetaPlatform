package com.metaplatform.wfe.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "wfe_task_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WfeTaskHistoryEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "task_id", nullable = false, length = 64)
    private String taskId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "process_instance_id", nullable = false, length = 64)
    private String processInstanceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "node_id", length = 128)
    private String nodeId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "assignee", length = 64)
    private String assignee;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "action", nullable = false, length = 32)
    private String action;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "operator", length = 64)
    private String operator;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "comment", length = 2048)
    private String comment;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "form_data", columnDefinition = "TEXT")
    private Map<String, Object> formData;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
