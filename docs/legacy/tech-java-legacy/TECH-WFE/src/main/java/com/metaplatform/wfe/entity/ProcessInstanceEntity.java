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
@Table(name = "wfe_process_instance")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessInstanceEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "process_definition_id", nullable = false, length = 64)
    private String processDefinitionId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "process_key", nullable = false, length = 128)
    private String processKey;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "business_key", length = 128)
    private String businessKey;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private ProcessInstanceStatus status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "start_user_id", length = 64)
    private String startUserId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "variables", columnDefinition = "TEXT")
    private Map<String, Object> variables;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
