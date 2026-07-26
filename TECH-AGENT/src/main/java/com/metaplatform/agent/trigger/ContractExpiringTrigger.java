package com.metaplatform.agent.trigger;

import com.metaplatform.ont.event.DomainEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * 合同到期预警触发器（P7.2）。
 *
 * <p>每 10 分钟扫描即将到期的合同，发布 {@code Contract.expiring} 事件，
 * 由 TriggerEngine 订阅并启动 Agent Run。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContractExpiringTrigger {

    private final DomainEventService domainEventService;

    @Value("${mate.trigger.contract.lead-days:45}")
    private int leadDays;

    /**
     * 每 10 分钟执行一次扫描。
     * 实际到期检测应通过 TECH-ONT Query Ontology，但 P7.2 占位阶段直接发布事件。
     */
    @Scheduled(fixedDelay = 600000)
    public void scanExpiringContracts() {
        // P7.2 占位：实际应通过 OntologyQueryMetric / ontology.search_objects 查询 Contract 对象
        // 此处仅 mock：发布一条 demo 事件
        log.info("[ContractExpiringTrigger] scanning expiring contracts leadDays={}", leadDays);
        domainEventService.publish(
                "tenant-default",
                "Contract.expiring",
                "Contract",
                "CONTRACT-DEMO-001",
                java.util.Map.of("leadDays", leadDays, "scannedAt", Instant.now().toString())
        );
    }
}
