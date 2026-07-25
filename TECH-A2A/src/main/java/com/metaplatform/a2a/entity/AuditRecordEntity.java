package com.metaplatform.a2a.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "audit_record")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditRecordEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "actor_id", length = 128)
    private String actorId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_id", length = 128)
    private String targetId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "details", nullable = false, columnDefinition = "jsonb")
    private String details;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "trace_id", length = 64)
    private String traceId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

}
