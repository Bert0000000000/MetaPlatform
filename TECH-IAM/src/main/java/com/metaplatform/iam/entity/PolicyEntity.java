package com.metaplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

@Entity
@Table(name = "iam_policy")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class PolicyEntity extends AuditEntity {

    public enum Effect {
        ALLOW,
        DENY
    }

    public enum SubjectType {
        USER,
        APP
    }

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "subject_type", nullable = false, length = 16)
    private SubjectType subjectType;

    @Column(name = "subject_id", nullable = false, length = 64)
    private String subjectId;

    @Column(name = "resource_type", nullable = false, length = 64)
    private String resourceType;

    /**
     * 资源 ID 列表：JSON 数组字符串，如 ["tool-1","tool-2"]。
     */
    @Column(name = "resource_ids", nullable = false, columnDefinition = "TEXT")
    private String resourceIds;

    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(name = "effect", nullable = false, length = 16)
    private Effect effect;

    /**
     * ABAC 条件表达式文本（如 SpEL / json-logic）。
     */
    @Column(name = "condition_expression", columnDefinition = "TEXT")
    private String conditionExpression;

    @Column(name = "effective_start_at")
    private Instant effectiveStartAt;

    @Column(name = "effective_end_at")
    private Instant effectiveEndAt;

    @Column(name = "priority", nullable = false)
    private Integer priority;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}
