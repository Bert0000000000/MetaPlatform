package com.metaplatform.ea.governance.compliance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 架构合规性违规项。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComplianceViolation {

    /** 关联的架构原则编码，例如 TECH_STANDARD_COMPLIANCE / DOC_COMPLETENESS / TECH_DEBT_MANAGEMENT */
    private String principleCode;

    /** 违规严重度：INFO / WARNING / ERROR */
    private String severity;

    /** 违规说明 */
    private String message;

    /** 修复建议 */
    private String recommendation;

    /** 证据：例如具体技术组件名称、雷达环位、缺失字段名 */
    private String evidence;
}
