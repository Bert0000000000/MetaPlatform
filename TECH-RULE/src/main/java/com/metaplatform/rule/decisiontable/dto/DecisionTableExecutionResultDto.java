package com.metaplatform.rule.decisiontable.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 决策表执行结果（V11-03：APP-ONTSTUDIO 决策表执行 API 后端化）。
 *
 * <p>与前端 {@code DecisionTableExecutionResult} 类型对齐：
 * <pre>
 * {
 *   "matchedRows": [...],   // 命中的行（含原行结构）
 *   "outputs": [{...}, ...] // 每个命中行对应的输出 map 列表
 * }
 * </pre>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionTableExecutionResultDto {

    private List<DecisionTableRowResponse> matchedRows;
    private List<Map<String, Object>> outputs;
    private long executionTimeMs;
}
