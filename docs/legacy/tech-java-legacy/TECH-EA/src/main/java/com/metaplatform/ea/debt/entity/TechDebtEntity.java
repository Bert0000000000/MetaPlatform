package com.metaplatform.ea.debt.entity;

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
@Table(name = "ea_tech_debt")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechDebtEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "title", nullable = false, length = 256)
    private String title;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "category", length = 64)
    private String category;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "severity", nullable = false, length = 32)
    private String severity;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "scope_type", length = 64)
    private String scopeType;

    @Column(name = "scope_id")
    private UUID scopeId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "impact_score")
    private Integer impactScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "remediation", columnDefinition = "TEXT")
    private String remediation;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "estimated_effort", length = 64)
    private String estimatedEffort;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "owner", length = 128)
    private String owner;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "debt_level", length = 32)
    private String debtLevel;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "repayment_plan", columnDefinition = "jsonb")
    private String repaymentPlan;

}
