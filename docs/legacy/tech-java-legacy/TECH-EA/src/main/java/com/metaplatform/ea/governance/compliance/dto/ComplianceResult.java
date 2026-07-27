package com.metaplatform.ea.governance.compliance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 架构合规性评估结果。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComplianceResult {

    /** 评估目标类型：APPLICATION / TECH_STACK */
    private String targetType;

    /** 评估目标 ID */
    private UUID targetId;

    /** 评估目标名称（用于报告展示） */
    private String targetName;

    /** 是否通过评估（violations 为空即通过） */
    private boolean passed;

    /** 违规列表 */
    private List<ComplianceViolation> violations;

    /** 评估时间 */
    private Instant assessedAt;

    /** 评估摘要 */
    private String summary;
}
