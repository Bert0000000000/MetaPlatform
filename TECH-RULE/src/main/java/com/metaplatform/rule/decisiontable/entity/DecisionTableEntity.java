package com.metaplatform.rule.decisiontable.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "rule_decision_table",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "code"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionTableEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "ruleset_id", length = 64)
    private String rulesetId;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "hit_policy", nullable = false, length = 16)
    @Builder.Default
    private String hitPolicy = "FIRST";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_columns", columnDefinition = "jsonb")
    @Builder.Default
    private String inputColumns = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_columns", columnDefinition = "jsonb")
    @Builder.Default
    private String outputColumns = "[]";

    @Column(name = "status", nullable = false, length = 16)
    @Builder.Default
    private String status = "DRAFT";

    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
