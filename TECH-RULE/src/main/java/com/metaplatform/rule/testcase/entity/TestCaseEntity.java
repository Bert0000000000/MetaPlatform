package com.metaplatform.rule.testcase.entity;

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
@Table(name = "rule_test_case")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestCaseEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "rule_id", length = 64)
    private String ruleId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "ruleset_id", nullable = false, length = 64)
    private String rulesetId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> input;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "expected_output", columnDefinition = "jsonb")
    private Map<String, Object> expectedOutput;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "actual_output", columnDefinition = "jsonb")
    private Map<String, Object> actualOutput;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_type", length = 16)
    private String targetType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_id", length = 64)
    private String targetId;

}
