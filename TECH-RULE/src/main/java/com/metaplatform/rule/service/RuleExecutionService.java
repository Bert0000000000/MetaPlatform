package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.common.TenantContext;
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

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RuleExecutionService {

    private final RuleSetRepository ruleSetRepository;
    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final ObjectMapper objectMapper;

    private final ExpressionParser parser = new SpelExpressionParser();

    @Transactional(readOnly = true)
    public List<RuleExecutionResult> execute(String rulesetId, Map<String, Object> inputData) {
        String tenantId = TenantContext.get();

        // 验证规则集存在
        RuleSetEntity ruleSet = ruleSetRepository.findByIdAndDeletedFalse(rulesetId)
                .orElseThrow(() -> new RuleException(ErrorCode.RULESET_NOT_FOUND));
        if (!tenantId.equals(ruleSet.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }

        // 加载所有 enabled 且未删除的规则，按 priority 升序
        List<RuleDefinitionEntity> rules =
                ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                        tenantId, rulesetId);

        // 创建 SpEL 求值上下文
        EvaluationContext context = createEvaluationContext(inputData);

        // 逐条求值
        return rules.stream()
                .map(rule -> evaluateRule(rule, context))
                .toList();
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
