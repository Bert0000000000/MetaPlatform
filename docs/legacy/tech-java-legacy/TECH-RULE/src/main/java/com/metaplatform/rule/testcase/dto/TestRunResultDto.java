package com.metaplatform.rule.testcase.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * 批量运行测试用例结果（V11-03：APP-ONTSTUDIO 测试用例 API 后端化）。
 *
 * <p>与前端 {@code TestRun} 类型对齐：
 * <pre>
 * {
 *   "id": "tr-...",
 *   "ruleId": "...",
 *   "decisionTableId": "...",   // 由 targetType=DECISION_TABLE + targetId 派生
 *   "startedAt": "...",
 *   "finishedAt": "...",
 *   "totalCases": 5,
 *   "passedCount": 3,
 *   "failedCount": 2,
 *   "errorCount": 0,
 *   "results": [...TestCaseResponse]
 * }
 * </pre>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestRunResultDto {

    private String id;
    private String ruleId;
    private String decisionTableId;
    private Instant startedAt;
    private Instant finishedAt;
    private Integer totalCases;
    private Integer passedCount;
    private Integer failedCount;
    private Integer errorCount;
    private List<TestCaseResponse> results;
}
