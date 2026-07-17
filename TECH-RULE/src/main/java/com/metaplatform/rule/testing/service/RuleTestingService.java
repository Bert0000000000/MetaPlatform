package com.metaplatform.rule.testing.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.decisiontable.entity.DecisionTableEntity;
import com.metaplatform.rule.decisiontable.entity.DecisionTableRowEntity;
import com.metaplatform.rule.decisiontable.service.DecisionTableRowService;
import com.metaplatform.rule.decisiontable.service.DecisionTableService;
import com.metaplatform.rule.dto.RuleExecutionResult;
import com.metaplatform.rule.entity.RuleDefinitionEntity;
import com.metaplatform.rule.exception.RuleException;
import com.metaplatform.rule.repository.RuleDefinitionRepository;
import com.metaplatform.rule.service.RuleExecutionService;
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
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class RuleTestingService {

    private final RuleExecutionService ruleExecutionService;
    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final DecisionTableService decisionTableService;
    private final DecisionTableRowService decisionTableRowService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public RuleTestResult testRule(String ruleId, RuleTestRequest request) {
        RuleDefinitionEntity rule = ruleDefinitionRepository.findByIdAndDeletedFalse(ruleId)
                .orElseThrow(() -> new RuleException(ErrorCode.RULE_NOT_FOUND));

        long start = System.currentTimeMillis();
        try {
            List<RuleExecutionResult> results =
                    ruleExecutionService.execute(rule.getRulesetId(), request.getInputData());

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
        List<RuleExecutionResult> results = ruleExecutionService.execute(rulesetId, request.getInputData());
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

    @Transactional(readOnly = true)
    public DecisionTableTestResult testDecisionTable(String tableId, RuleTestRequest request) {
        DecisionTableEntity table = decisionTableService.getEntity(tableId);
        List<DecisionTableRowEntity> rows = decisionTableRowService.getEnabledRows(tableId);

        long start = System.currentTimeMillis();
        List<Map<String, Object>> matchedOutputs = new ArrayList<>();
        String hitPolicy = table.getHitPolicy();

        for (DecisionTableRowEntity row : rows) {
            Map<String, Object> rowInputs = readMap(row.getInputValues());
            if (matchesInput(request.getInputData(), rowInputs)) {
                Map<String, Object> rowOutputs = readMap(row.getOutputValues());
                matchedOutputs.add(rowOutputs);
                if ("FIRST".equalsIgnoreCase(hitPolicy)) {
                    break;
                }
            }
        }
        long elapsed = System.currentTimeMillis() - start;

        return DecisionTableTestResult.builder()
                .tableId(tableId)
                .matchedOutputs(matchedOutputs)
                .matchedRowCount(matchedOutputs.size())
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

    private boolean matchesInput(Map<String, Object> inputData, Map<String, Object> rowInputs) {
        for (Map.Entry<String, Object> entry : rowInputs.entrySet()) {
            Object inputValue = inputData.get(entry.getKey());
            if (!Objects.equals(String.valueOf(entry.getValue()), String.valueOf(inputValue))) {
                return false;
            }
        }
        return true;
    }

    private Map<String, Object> readMap(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}
