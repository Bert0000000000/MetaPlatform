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
@Table(name = "wfe_task")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WfeTaskEntity {

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
    @Column(name = "process_definition_id", length = 64)
    private String processDefinitionId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "node_id", nullable = false, length = 128)
    private String nodeId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "node_name", nullable = false, length = 256)
    private String nodeName;

    /**
     * 任务名称，通常与 nodeName 保持一致（用于 DTO 映射）。
     */
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "assignee", length = 64)
    private String assignee;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "action", length = 32)
    private String action;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "form_data", columnDefinition = "TEXT")
    private Map<String, Object> formData;

    @Column(name = "due_date")
    private Instant dueDate;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
