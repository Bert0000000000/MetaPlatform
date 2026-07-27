package com.metaplatform.ont.action;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Ontology Action 定义（P1.1.4）。
 *
 * <p>声明 Action 的元数据：参数 Schema、风险等级、审批要求、副作用描述。
 * 具体执行逻辑由 {@code TECH-ACTION} 模块承载。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ont_action")
public class ActionEntity {

    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "action_code", nullable = false, length = 128)
    private String actionCode;

    @Column(name = "target_concept_code", nullable = false, length = 64)
    private String targetConceptCode;

    @Column(name = "display_name", nullable = false, length = 256)
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "parameter_schema", nullable = false, columnDefinition = "TEXT")
    private String parameterSchema;

    @Column(name = "return_schema", columnDefinition = "TEXT")
    private String returnSchema;

    @Column(name = "risk_level", nullable = false, length = 16)
    private String riskLevel;

    @Column(name = "approval_required", nullable = false)
    private boolean approvalRequired;

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Column(name = "side_effect", columnDefinition = "TEXT")
    private String sideEffect;

    @Column(nullable = false)
    private boolean enabled;

    @Column(nullable = false)
    private int version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }
}
