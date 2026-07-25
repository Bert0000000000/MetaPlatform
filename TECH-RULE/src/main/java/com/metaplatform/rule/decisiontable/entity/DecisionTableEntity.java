package com.metaplatform.rule.decisiontable.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.time.Instant;

@Entity
@Table(name = "rule_decision_table")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionTableEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "hit_policy", nullable = false, length = 16)
    private String hitPolicy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_columns", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> inputColumns;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_columns", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> outputColumns;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "version", nullable = false)
    private Integer version;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", length = 64)
    private String createdBy;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "ruleset_id", length = 64)
    private String rulesetId;

}
