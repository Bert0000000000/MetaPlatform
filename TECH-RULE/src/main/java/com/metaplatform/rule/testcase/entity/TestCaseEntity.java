package com.metaplatform.rule.testcase.entity;

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
@Table(name = "rule_test_case")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestCaseEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "rule_id", length = 64)
    private String ruleId;

    @Column(name = "ruleset_id", length = 64)
    private String rulesetId;

    @Column(name = "target_type", length = 16)
    private String targetType;

    @Column(name = "target_id", length = 64)
    private String targetId;

    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input", columnDefinition = "jsonb")
    @Builder.Default
    private String input = "{}";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "expected_output", columnDefinition = "jsonb")
    private String expectedOutput;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "actual_output", columnDefinition = "jsonb")
    private String actualOutput;

    @Column(name = "status", nullable = false, length = 16)
    @Builder.Default
    private String status = "PENDING";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
