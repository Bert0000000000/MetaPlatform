package com.metaplatform.rule.testing.service;

import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.decisiontable.entity.DecisionTableEntity;
import com.metaplatform.rule.decisiontable.service.DecisionTableExecutionEngine;
import com.metaplatform.rule.decisiontable.service.DecisionTableService;
import com.metaplatform.rule.dto.RuleExecutionResult;
import com.metaplatform.rule.entity.RuleDefinitionEntity;
import com.metaplatform.rule.exception.RuleException;
import com.metaplatform.rule.repository.RuleDefinitionRepository;
import com.metaplatform.rule.service.RuleEngineService;
import com.metaplatform.rule.testing.dto.BatchTestRequest;
import com.metaplatform.rule.testing.dto.BatchTestResult;
import com.metaplatform.rule.testing.dto.DecisionTableTestResult;
import com.metaplatform.rule.testing.dto.RuleTestRequest;
import com.metaplatform.rule.testing.dto.RuleTestResult;
import com.metaplatform.rule.testing.dto.RulesetTestResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 规则测试服务（P1-RULE-09）。
 *
 * <p>P1-2：决策表测试改用 {@link DecisionTableExecutionEngine} 统一执行；
 * P1-3：规则集测试改用 {@link RuleEngineService#executeReadOnly}，发 Outbox 事件与统计的写入路径不被触发。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuleTestingService {

    private final RuleEngineService ruleEngineService;
    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final DecisionTableService decisionTableService;
    private final DecisionTableExecutionEngine decisionTableExecutionEngine;

    @Transactional(readOnly = true)
    public RuleTestResult testRule(String ruleId, RuleTestRequest request) {
        RuleDefinitionEntity rule = ruleDefinitionRepository.findByIdAndDeletedFalse(ruleId)
                .orElseThrow(() -> new RuleException(ErrorCode.RULE_NOT_FOUND));

        long start = System.currentTimeMillis();
        try {
            List<RuleExecutionResult> results =
                    ruleEngineService.executeReadOnly(rule.getRulesetId(), request.getInputData());

            RuleExecutionResult matched = results.stream()
                    .filter(r -> ruleId.equals(r.getRuleId()))
                    .findFirst()
                    .orElse(null);

            long elapsed = System.currentTimeMillis() - start;
            if (matched == null) {
                return RuleTestResult.builder()
                        .ruleId(rule.getId())
                        .ruleCode(rule.getCode())
                        .ruleName(rule.getName())
                        .matched(false)
                        .executionTimeMs(elapsed)
                        .build();
            }
            return RuleTestResult.builder()
                    .ruleId(matched.getRuleId())
                    .ruleCode(matched.getRuleCode())
                    .ruleName(matched.getRuleName())
                    .matched(matched.isMatched())
                    .output(matched.getAction() != null ? matched.getAction().getConfig() : null)
                    .executionTimeMs(elapsed)
                    .build();
        } catch (RuleException e) {
            throw e;
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            return RuleTestResult.builder()
                    .ruleId(rule.getId())
                    .ruleCode(rule.getCode())
                    .ruleName(rule.getName())
                    .matched(false)
                    .executionTimeMs(elapsed)
                    .error(e.getMessage())
                    .build();
        }
    }

    @Transactional(readOnly = true)
    public RulesetTestResult testRuleset(String rulesetId, RuleTestRequest request) {
        long start = System.currentTimeMillis();
        List<RuleExecutionResult> results = ruleEngineService.executeReadOnly(rulesetId, request.getInputData());
        long elapsed = System.currentTimeMillis() - start;

        List<RuleTestResult> testResults = results.stream()
                .map(r -> RuleTestResult.builder()
                        .ruleId(r.getRuleId())
                        .ruleCode(r.getRuleCode())
                        .ruleName(r.getRuleName())
                        .matched(r.isMatched())
                        .output(r.getAction() != null ? r.getAction().getConfig() : null)
                        .executionTimeMs(elapsed)
                        .build())
                .toList();

        int matchedCount = (int) testResults.stream().filter(RuleTestResult::isMatched).count();
        return RulesetTestResult.builder()
                .rulesetId(rulesetId)
                .results(testResults)
                .executionTimeMs(elapsed)
                .matchedCount(matchedCount)
                .build();
    }

    /**
     * P1-2：决策表测试改用 {@link DecisionTableExecutionEngine} 统一执行，
     * 共享完整操作符匹配能力。
     */
    @Transactional(readOnly = true)
    public DecisionTableTestResult testDecisionTable(String tableId, RuleTestRequest request) {
        DecisionTableEntity table = decisionTableService.getEntity(tableId);

        long start = System.currentTimeMillis();
        DecisionTableExecutionEngine.ExecutionOutcome outcome =
                decisionTableExecutionEngine.execute(table, request.getInputData(), Boolean.TRUE);
        long elapsed = System.currentTimeMillis() - start;

        return DecisionTableTestResult.builder()
                .tableId(tableId)
                .matchedOutputs(outcome.outputs())
                .matchedRowCount(outcome.outputs().size())
                .executionTimeMs(elapsed)
                .build();
    }

    @Transactional(readOnly = true)
    public BatchTestResult batchTest(BatchTestRequest request) {
        long totalStart = System.currentTimeMillis();
        List<RuleTestResult> results = new ArrayList<>();
        int matched = 0;
        int errors = 0;

        for (BatchTestRequest.BatchTestItem item : request.getItems()) {
            try {
                RuleTestRequest testReq = new RuleTestRequest();
                testReq.setInputData(item.getInputData());
                RuleTestResult result = testRule(item.getRuleId(), testReq);
                results.add(result);
                if (result.isMatched()) matched++;
                if (result.getError() != null) errors++;
            } catch (Exception e) {
                results.add(RuleTestResult.builder()
                        .ruleId(item.getRuleId())
                        .matched(false)
                        .error(e.getMessage())
                        .build());
                errors++;
            }
        }

        long totalElapsed = System.currentTimeMillis() - totalStart;
        return BatchTestResult.builder()
                .results(results)
                .totalCount(results.size())
                .matchedCount(matched)
                .errorCount(errors)
                .totalExecutionTimeMs(totalElapsed)
                .build();
    }
}
