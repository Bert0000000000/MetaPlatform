package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.common.TraceContext;
import com.metaplatform.rule.dto.RuleExecutionResponse;
import com.metaplatform.rule.dto.RuleExecutionResult;
import com.metaplatform.rule.entity.RuleDefinitionEntity;
import com.metaplatform.rule.entity.RuleSetEntity;
import com.metaplatform.rule.exception.RuleException;
import com.metaplatform.rule.monitoring.service.ExecutionLogService;
import com.metaplatform.rule.repository.RuleDefinitionRepository;
import com.metaplatform.rule.repository.RuleSetRepository;
import com.metaplatform.rule.statistics.service.StatisticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.PropertyAccessor;
import org.springframework.expression.TypedValue;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 规则集同步执行引擎（P1-RULE-02）。
 *
 * <p>使用 Spring Expression Language (SpEL) 作为轻量表达式引擎对规则条件求值。
 * Drools 在 Java 21 / Spring Boot 3.4 下存在依赖兼容性风险，SpEL 已能满足
 * "orderAmount >= 100000 && customerType == 'VIP'" 等条件表达式需求，
 * 且零额外依赖、与 Spring 生态原生集成。</p>
 *
 * <p>P0 改造：
 * <ul>
 *   <li>P0-1：执行完规则集后按 RULESET 维度调用 {@link StatisticsService#recordExecution}</li>
 *   <li>P0-2：每条规则评估后调用 {@link ExecutionLogService#writeLog} 异步写 ExecutionLog</li>
 *   <li>P0-3：求值前调用 {@link OntologyRelationResolver#enrich} 解析 customer.orders.totalAmount 关系路径</li>
 * </ul>
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuleEngineService {

    /** 统计 target_type 常量 */
    private static final String TARGET_TYPE_RULESET = "RULESET";

    private final RuleSetRepository ruleSetRepository;
    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final RuleOutboxService ruleOutboxService;
    private final ObjectMapper objectMapper;
    private final StatisticsService statisticsService;
    private final ExecutionLogService executionLogService;
    private final OntologyRelationResolver ontologyRelationResolver;

    private final ExpressionParser parser = new SpelExpressionParser();

    /**
     * 按规则集 ID 执行规则集（写事务，含 Outbox 事件）。
     *
     * @param rulesetId 规则集 ID
     * @param inputData 输入数据（Map 形式，key 为变量名）
     * @return 执行响应（包含结果列表和执行耗时）
     */
    @Transactional
    public RuleExecutionResponse executeRuleset(String rulesetId, Map<String, Object> inputData) {
        String tenantId = TenantContext.get();
        String traceId = TraceContext.getOrCreate();
        long startTime = System.currentTimeMillis();

        RuleSetEntity ruleSet = ruleSetRepository.findByIdAndDeletedFalse(rulesetId)
                .orElseThrow(() -> new RuleException(ErrorCode.RULESET_NOT_FOUND));
        if (!tenantId.equals(ruleSet.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }

        // 规则集禁用时直接返回空结果
        if (Boolean.FALSE.equals(ruleSet.getEnabled())) {
            long elapsed = System.currentTimeMillis() - startTime;
            recordStatsSafe(TARGET_TYPE_RULESET, rulesetId, false, false, elapsed);
            return RuleExecutionResponse.builder()
                    .results(Collections.emptyList())
                    .executionTimeMs(elapsed)
                    .build();
        }

        // 加载所有 enabled 且未删除的规则，按 priority 升序
        List<RuleDefinitionEntity> rules =
                ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                        tenantId, rulesetId);

        // P0-3：在求值前调用 OntologyRelationResolver.enrich 解析关系路径
        Map<String, Object> enrichedInput = enrichInputData(inputData, rules);
        EvaluationContext context = createEvaluationContext(enrichedInput);

        List<RuleExecutionResult> results = new ArrayList<>();
        boolean anyMatched = false;
        boolean hasError = false;

        for (RuleDefinitionEntity rule : rules) {
            long ruleStart = System.currentTimeMillis();
            RuleExecutionResult result = evaluateRule(rule, context);
            long ruleElapsed = System.currentTimeMillis() - ruleStart;
            boolean isError = result.getErrorMessage() != null;
            results.add(result);
            if (result.isMatched()) {
                anyMatched = true;
            }
            if (isError) {
                hasError = true;
            }

            // P0-2：异步写入 ExecutionLog（失败不影响主流程）
            writeExecutionLogSafe(tenantId, traceId, rule.getId(), rulesetId,
                    result.isMatched(), ruleElapsed, enrichedInput,
                    result.getAction() != null ? result.getAction().getConfig() : null,
                    result.getErrorMessage());

            ruleOutboxService.publishEvent(tenantId, rulesetId, rule.getId(),
                    rule.getCode(), result.isMatched(), enrichedInput);
        }

        long totalElapsed = System.currentTimeMillis() - startTime;

        // P0-1：按规则集维度记录统计
        recordStatsSafe(TARGET_TYPE_RULESET, rulesetId, anyMatched, hasError, totalElapsed);

        return RuleExecutionResponse.builder()
                .results(results)
                .executionTimeMs(totalElapsed)
                .build();
    }

    /**
     * 按规则集编码执行规则集。
     *
     * @param rulesetCode 规则集编码
     * @param inputData   输入数据
     * @return 执行响应
     */
    @Transactional(readOnly = true)
    public RuleExecutionResponse executeRulesetByCode(String rulesetCode, Map<String, Object> inputData) {
        String tenantId = TenantContext.get();
        RuleSetEntity ruleSet = ruleSetRepository.findByTenantIdAndCodeAndDeletedFalse(tenantId, rulesetCode)
                .orElseThrow(() -> new RuleException(ErrorCode.RULESET_NOT_FOUND));
        return executeRuleset(ruleSet.getId(), inputData);
    }

    /**
     * 只读执行（P1-3：供测试场景使用，不发 Outbox 事件、不写统计）。
     *
     * <p>用于 RuleTestingService.testRule/testRuleset 等不需要副作用的场景。
     * 通过新事务挂起外层事务以确保只读语义。</p>
     *
     * @param rulesetId 规则集 ID
     * @param inputData 输入数据
     * @return 规则执行结果列表
     */
    @Transactional(readOnly = true)
    public List<RuleExecutionResult> executeReadOnly(String rulesetId, Map<String, Object> inputData) {
        String tenantId = TenantContext.get();

        RuleSetEntity ruleSet = ruleSetRepository.findByIdAndDeletedFalse(rulesetId)
                .orElseThrow(() -> new RuleException(ErrorCode.RULESET_NOT_FOUND));
        if (!tenantId.equals(ruleSet.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }
        if (Boolean.FALSE.equals(ruleSet.getEnabled())) {
            return Collections.emptyList();
        }

        List<RuleDefinitionEntity> rules =
                ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                        tenantId, rulesetId);

        Map<String, Object> enrichedInput = enrichInputData(inputData, rules);
        EvaluationContext context = createEvaluationContext(enrichedInput);

        List<RuleExecutionResult> results = new ArrayList<>();
        for (RuleDefinitionEntity rule : rules) {
            results.add(evaluateRule(rule, context));
        }
        return results;
    }

    private RuleExecutionResult evaluateRule(RuleDefinitionEntity rule, EvaluationContext context) {
        boolean matched = false;
        String errorMessage = null;
        try {
            Boolean result = parser.parseExpression(rule.getConditionExpr()).getValue(context, Boolean.class);
            matched = Boolean.TRUE.equals(result);
        } catch (Exception e) {
            log.warn("Rule evaluation failed for rule {}: {}", rule.getId(), e.getMessage());
            errorMessage = e.getMessage();
        }

        RuleExecutionResult.ActionInfo actionInfo = RuleExecutionResult.ActionInfo.builder()
                .type(rule.getActionType())
                .config(rule.getActionConfig())
                .build();

        return RuleExecutionResult.builder()
                .ruleId(rule.getId())
                .ruleCode(rule.getCode())
                .ruleName(rule.getName())
                .matched(matched)
                .action(actionInfo)
                .errorMessage(errorMessage)
                .build();
    }

    /**
     * P0-3：通过 OntologyRelationResolver 解析条件表达式中的关系路径，
     * 将相关实体的关系属性注入到输入数据中。
     *
     * <p>失败时不抛异常（降级为原始输入），仅记录警告。</p>
     */
    private Map<String, Object> enrichInputData(Map<String, Object> inputData, List<RuleDefinitionEntity> rules) {
        if (rules.isEmpty()) {
            return inputData;
        }
        List<String> conditionExprs = rules.stream()
                .map(RuleDefinitionEntity::getConditionExpr)
                .filter(expr -> expr != null && !expr.isBlank())
                .toList();
        if (conditionExprs.isEmpty()) {
            return inputData;
        }
        try {
            return ontologyRelationResolver.enrich(inputData, conditionExprs);
        } catch (Exception e) {
            log.warn("OntologyRelationResolver.enrich failed, fallback to raw input: {}", e.getMessage());
            return inputData;
        }
    }

    /** P0-1：统计写入包裹 try-catch，确保失败不影响主流程。 */
    private void recordStatsSafe(String targetType, String targetId,
                                  boolean hit, boolean error, long durationMs) {
        try {
            statisticsService.recordExecution(targetType, targetId, hit, error, durationMs);
        } catch (Exception e) {
            log.warn("Failed to record execution statistics: targetType={}, targetId={}, error={}",
                    targetType, targetId, e.getMessage());
        }
    }

    /** P0-2：ExecutionLog 写入包裹 try-catch（@Async 方法本身也兜底，双保险）。 */
    private void writeExecutionLogSafe(String tenantId, String traceId, String ruleId, String rulesetId,
                                        boolean matched, long executionTimeMs,
                                        Map<String, Object> inputData, Map<String, Object> outputData,
                                        String errorMessage) {
        try {
            executionLogService.writeLog(tenantId, traceId, ruleId, rulesetId,
                    matched, executionTimeMs, inputData, outputData, errorMessage);
        } catch (Exception e) {
            log.warn("Failed to dispatch execution log: ruleId={}, error={}", ruleId, e.getMessage());
        }
    }

    private EvaluationContext createEvaluationContext(Map<String, Object> inputData) {
        StandardEvaluationContext context = new StandardEvaluationContext(inputData);
        context.addPropertyAccessor(new MapPropertyAccessor());
        return context;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(JsonNode jsonNode) {
        if (jsonNode == null) {
            return null;
        }
        return objectMapper.convertValue(jsonNode, Map.class);
    }

    /**
     * 自定义 SpEL PropertyAccessor，支持从 Map 中按 key 读取属性。
     * 使得表达式 "amount >= 100000" 能作用于 Map root object {amount: 120000}。
     */
    private static class MapPropertyAccessor implements PropertyAccessor {

        @Override
        public Class<?>[] getSpecificTargetClasses() {
            return new Class<?>[] { Map.class };
        }

        @Override
        public boolean canRead(EvaluationContext context, Object target, String name) {
            return target instanceof Map<?, ?> map && map.containsKey(name);
        }

        @Override
        public TypedValue read(EvaluationContext context, Object target, String name) {
            return new TypedValue(((Map<?, ?>) target).get(name));
        }

        @Override
        public boolean canWrite(EvaluationContext context, Object target, String name) {
            return true;
        }

        @Override
        @SuppressWarnings("unchecked")
        public void write(EvaluationContext context, Object target, String name, Object newValue) {
            ((Map<String, Object>) target).put(name, newValue);
        }
    }
}
