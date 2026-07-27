package com.metaplatform.rule.monitoring.service;

import com.metaplatform.rule.monitoring.entity.ExecutionLogEntity;
import com.metaplatform.rule.monitoring.repository.ExecutionLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * 规则执行日志写入服务（P1-RULE-11 监控）。
 *
 * <p>独立 Bean 以便 {@link com.metaplatform.rule.service.RuleEngineService} 调用时
 * 走 Spring AOP 代理，使 {@link Async} 生效；异步线程内显式传入 tenantId/traceId，
 * 不依赖主线程的 ThreadLocal（避免线程切换后丢失上下文）。</p>
 *
 * <p>所有写入均包裹 try-catch，确保日志失败不会影响规则主流程。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionLogService {

    private final ExecutionLogRepository executionLogRepository;

    /**
     * 异步写入一条规则执行日志。
     *
     * @param tenantId       租户 ID（显式传入，避免跨线程 ThreadLocal 丢失）
     * @param traceId        链路 ID（显式传入）
     * @param ruleId         规则 ID（可空，决策表场景为 null）
     * @param rulesetId      规则集 ID（可空）
     * @param matched        是否命中
     * @param executionTimeMs 执行耗时（ms）
     * @param inputData      输入数据（可空）
     * @param outputData     输出数据（可空）
     * @param errorMessage   错误信息（可空，非空表示执行异常）
     */
    @Async
    @Transactional
    public void writeLog(String tenantId, String traceId, String ruleId, String rulesetId,
                          boolean matched, long executionTimeMs,
                          Map<String, Object> inputData, Map<String, Object> outputData,
                          String errorMessage) {
        try {
            ExecutionLogEntity entity = ExecutionLogEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .ruleId(ruleId)
                    .rulesetId(rulesetId)
                    .input(inputData)
                    .output(outputData)
                    .matched(matched)
                    .executionTimeMs(executionTimeMs)
                    .errorMessage(errorMessage)
                    .traceId(traceId)
                    .build();
            executionLogRepository.save(entity);
        } catch (Exception e) {
            log.warn("Failed to write execution log: tenantId={}, ruleId={}, error={}",
                    tenantId, ruleId, e.getMessage());
        }
    }
}
