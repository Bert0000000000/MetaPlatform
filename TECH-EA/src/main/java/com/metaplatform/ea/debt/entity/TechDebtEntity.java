package com.metaplatform.ea.debt.entity;

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
@Table(name = "ea_tech_debt")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechDebtEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String title;

    @Column(nullable = false, length = 128)
    private String code;

    @Column(length = 64)
    private String category;

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String severity = "MEDIUM";

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String status = "OPEN";

    @Column(name = "scope_type", length = 64)
    private String scopeType;

    @Column(name = "scope_id")
    private UUID scopeId;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "impact_score")
    @Builder.Default
    private Integer impactScore = 0;

    @Column(columnDefinition = "TEXT")
    private String remediation;

    @Column(name = "estimated_effort", length = 64)
    private String estimatedEffort;

    @Column(length = 128)
    private String owner;

    @Column(name = "debt_level", length = 32)
    @Builder.Default
    private String debtLevel = "GENERAL";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "repayment_plan", columnDefinition = "jsonb")
    @Builder.Default
    private String repaymentPlan = "{}";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "metadata", columnDefinition = "jsonb")
    @Builder.Default
    private String metadata = "{}";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}