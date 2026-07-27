package com.metaplatform.ea.impact.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 能力影响分析结果。
 *
 * <p>字段与 APP-ARCH 前端 ImpactAnalysisResult 接口对齐：
 * <ul>
 *   <li>affectedCapabilities — 受影响的下级能力 ID 列表（含自身）</li>
 *   <li>affectedApplications — 引用该能力的应用 ID 列表</li>
 *   <li>affectedProcesses — 引用该能力的业务流程 ID 列表</li>
 *   <li>riskLevel — 风险等级 high / medium / low</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImpactAnalysisResponse {

    private List<String> affectedCapabilities;
    private List<String> affectedApplications;
    private List<String> affectedProcesses;
    private String riskLevel;
    private String summary;
}
