package com.metaplatform.ea.process.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "ea_business_process_version")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusinessProcessVersionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "process_id", nullable = false)
    private UUID processId;

    @Column(name = "version", nullable = false)
    private Integer version;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "process_steps", columnDefinition = "jsonb")
    private String processSteps;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "flowchart", columnDefinition = "jsonb")
    private String flowchart;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "change_note", columnDefinition = "TEXT")
    private String changeNote;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", length = 128)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
