package com.metaplatform.ea.process.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Immutable snapshot of a business process. New revisions are inserted;
 * existing rows are never mutated.
 */
@Entity
@Table(name = "ea_business_process_version")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusinessProcessVersionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "process_id", nullable = false)
    private UUID processId;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "process_steps", columnDefinition = "jsonb")
    @Builder.Default
    private String processSteps = "[]";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "flowchart", columnDefinition = "jsonb")
    @Builder.Default
    private String flowchart = "{}";

    @Column(name = "change_note", columnDefinition = "TEXT")
    private String changeNote;

    @Column(name = "created_by", length = 128)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}