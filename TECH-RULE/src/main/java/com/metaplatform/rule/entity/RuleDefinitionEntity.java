package com.metaplatform.rule.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "rule_definition")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RuleDefinitionEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "ruleset_id", nullable = false, length = 64)
    private String rulesetId;

    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "condition_expr", nullable = false, columnDefinition = "TEXT")
    private String conditionExpr;

    @Column(name = "action_type", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private ActionType actionType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "action_config", columnDefinition = "jsonb")
    private JsonNode actionConfig;

    @Column(name = "priority", nullable = false)
    @Builder.Default
    private Integer priority = 0;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "deleted", nullable = false)
    @Builder.Default
    private Boolean deleted = false;

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
}
