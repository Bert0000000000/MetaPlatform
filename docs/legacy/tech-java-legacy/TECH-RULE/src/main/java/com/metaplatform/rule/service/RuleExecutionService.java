package com.metaplatform.rule.service;

import com.metaplatform.rule.dto.RuleExecutionResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 规则执行只读服务（P1-RULE-02 旧入口）。
 *
 * <p>P1-3：合并改造——保留类名以维持向后兼容，但实现完全委托给
 * {@link RuleEngineService#executeReadOnly}，避免两份 evaluateRule + MapPropertyAccessor
 * 维护漂移。原 @Transactional(readOnly=true) 语义由被委托方保证。</p>
 *
 * <p>调用方：{@link com.metaplatform.rule.testing.service.RuleTestingService} 已切换到
 * {@link RuleEngineService#executeReadOnly} 直连；本类仅作为旧 Controller/外部
 * 调用入口保留，不再承载独立执行逻辑。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuleExecutionService {

    private final RuleEngineService ruleEngineService;

    /**
     * 只读执行规则集（不发 Outbox、不写统计/日志）。
     *
     * @param rulesetId 规则集 ID
     * @param inputData 输入数据
     * @return 规则执行结果列表
     */
    @Transactional(readOnly = true)
    public List<RuleExecutionResult> execute(String rulesetId, Map<String, Object> inputData) {
        return ruleEngineService.executeReadOnly(rulesetId, inputData);
    }
}
