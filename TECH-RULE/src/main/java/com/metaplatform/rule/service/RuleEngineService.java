package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleExecutionResponse;
import com.metaplatform.rule.dto.RuleExecutionResult;
import com.metaplatform.rule.entity.RuleDefinitionEntity;
import com.metaplatform.rule.entity.RuleSetEntity;
import com.metaplatform.rule.exception.RuleException;
import com.metaplatform.rule.repository.RuleDefinitionRepository;
import com.metaplatform.rule.repository.RuleSetRepository;
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
 * 使用 Spring Expression Language (SpEL) 作为轻量表达式引擎对规则条件求值。
 * Drools 在 Java 21 / Spring Boot 3.4 下存在依赖兼容性风险，SpEL 已能满足
 * "orderAmount >= 100000 && customerType == 'VIP'" 等条件表达式需求，
 * 且零额外依赖、与 Spring 生态原生集成。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuleEngineService {

    private final RuleSetRepository ruleSetRepository;
    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final RuleOutboxService ruleOutboxService;
    private final ObjectMapper objectMapper;

    private final ExpressionParser parser = new SpelExpressionParser();

    /**
     * 按规则集 ID 执行规则集。
     *
     * @param rulesetId 规则集 ID
     * @param inputData 输入数据（Map 形式，key 为变量名）
     * @return 执行响应（包含结果列表和执行耗时）
     */
    @Transactional
    public RuleExecutionResponse executeRuleset(String rulesetId, Map<String, Object> inputData) {
        String tenantId = TenantContext.get();
        long startTime = System.currentTimeMillis();

        RuleSetEntity ruleSet = ruleSetRepository.findByIdAndDeletedFalse(rulesetId)
                .orElseThrow(() -> new RuleException(ErrorCode.RULESET_NOT_FOUND));
        if (!tenantId.equals(ruleSet.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }

        // 规则集禁用时直接返回空结果
        if (Boolean.FALSE.equals(ruleSet.getEnabled())) {
            return RuleExecutionResponse.builder()
                    .results(Collections.emptyList())
                    .executionTimeMs(System.currentTimeMillis() - startTime)
                    .build();
        }

        // 加载所有 enabled 且未删除的规则，按 priority 升序
        List<RuleDefinitionEntity> rules =
                ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                        tenantId, rulesetId);

        EvaluationContext context = createEvaluationContext(inputData);

        List<RuleExecutionResult> results = new ArrayList<>();
        for (RuleDefinitionEntity rule : rules) {
            RuleExecutionResult result = evaluateRule(rule, context);
            results.add(result);
            ruleOutboxService.publishEvent(tenantId, rulesetId, rule.getId(),
                    rule.getCode(), result.isMatched(), inputData);
        }

        return RuleExecutionResponse.builder()
                .results(results)
                .executionTimeMs(System.currentTimeMillis() - startTime)
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

    private RuleExecutionResult evaluateRule(RuleDefinitionEntity rule, EvaluationContext context) {
        boolean matched = false;
        try {
            Boolean result = parser.parseExpression(rule.getConditionExpr()).getValue(context, Boolean.class);
            matched = Boolean.TRUE.equals(result);
        } catch (Exception e) {
            log.warn("Rule evaluation failed for rule {}: {}", rule.getId(), e.getMessage());
        }

        return RuleExecutionResult.builder()
                .ruleId(rule.getId())
                .ruleCode(rule.getCode())
                .ruleName(rule.getName())
                .matched(matched)
                .action(RuleExecutionResult.ActionInfo.builder()
                        .type(rule.getActionType().name())
                        .config(toMap(rule.getActionConfig()))
                        .build())
                .build();
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
