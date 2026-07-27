package com.metaplatform.rule.testcase.dto;

import lombok.Data;

import java.util.List;

/**
 * 批量运行测试用例请求（V11-03：APP-ONTSTUDIO 测试用例 API 后端化）。
 *
 * <p>与前端 {@code TestRunRequest} 类型对齐。支持以下过滤维度（任一组合）：
 * <ul>
 *   <li>{@code testCaseIds} - 显式指定用例 ID 列表</li>
 *   <li>{@code ruleId} - 按规则 ID 过滤</li>
 *   <li>{@code targetType} + {@code targetId} - 按目标过滤（如 DECISION_TABLE + dt-001）</li>
 * </ul>
 */
@Data
public class TestRunRequestDto {

    private List<String> testCaseIds;
    private String ruleId;
    private String targetType;
    private String targetId;
}
