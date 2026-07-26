package com.metaplatform.agent.scheduled;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.metaplatform.msg.topology.TopologyTopics;

/**
 * Scheduled Agent Service（P3.3.2）。
 *
 * <p>提供：</p>
 * <ul>
 *   <li>{@link #create}：注册定时任务</li>
 *   <li>{@link #tick}：被定时调度器调用，触发到期的任务</li>
 *   <li>{@link #pause} / {@link #resume} / {@link #triggerNow}</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduledAgentService {

    private final ScheduledAgentRepository repository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public ScheduledAgentEntity create(ScheduledAgentEntity s) {
        s.setId("SCH-" + UUID.randomUUID());
        s.setEnabled(true);
        s.setCreatedAt(Instant.now());
        s.setNextRunAt(computeNextRun(s));
        return repository.save(s);
    }

    /**
     * 调度器每次 tick 调用：触发所有 nextRunAt <= now 的任务。
     */
    public int tick() {
        List<ScheduledAgentEntity> due = repository.findByEnabledTrueAndNextRunAtLessThanEqual(Instant.now());
        for (ScheduledAgentEntity s : due) {
            // 简单 SKIP 重叠策略
            if ("SKIP".equals(s.getOverlapPolicy())) {
                kafkaTemplate.send(TopologyTopics.AGENT_RUN_STATE_CHANGED, s.getAgentId(),
                        java.util.Map.of(
                                "scheduledId", s.getId(),
                                "tenantId", s.getTenantId(),
                                "agentId", s.getAgentId(),
                                "trigger", "scheduler",
                                "inputPayload", s.getInputPayload() == null ? "{}" : s.getInputPayload()
                        ));
                s.setLastRunAt(Instant.now());
                s.setNextRunAt(computeNextRun(s));
                repository.save(s);
                log.info("[ScheduledAgentService] triggered scheduledId={} agent={}", s.getId(), s.getAgentId());
            }
        }
        return due.size();
    }

    public void pause(String id) {
        ScheduledAgentEntity s = repository.findById(id).orElseThrow();
        s.setEnabled(false);
        repository.save(s);
    }

    public void resume(String id) {
        ScheduledAgentEntity s = repository.findById(id).orElseThrow();
        s.setEnabled(true);
        s.setNextRunAt(computeNextRun(s));
        repository.save(s);
    }

    public void triggerNow(String id) {
        ScheduledAgentEntity s = repository.findById(id).orElseThrow();
        kafkaTemplate.send(TopologyTopics.AGENT_RUN_STATE_CHANGED, s.getAgentId(),
                java.util.Map.of("scheduledId", s.getId(), "trigger", "manual"));
        s.setLastRunAt(Instant.now());
        repository.save(s);
    }

    private Instant computeNextRun(ScheduledAgentEntity s) {
        return switch (s.getScheduleKind()) {
            case "ONCE" -> s.getRunAt() == null ? Instant.now() : s.getRunAt();
            case "INTERVAL" -> Instant.now().plusSeconds(s.getIntervalSec() == null ? 1800 : s.getIntervalSec());
            case "CRON" -> nextCron(s.getCronExpression());
            default -> Instant.now().plusSeconds(1800);
        };
    }

    private Instant nextCron(String expr) {
        // P3.3 占位：使用 CronExpression 解析；此处直接 +1h
        return Instant.now().plusSeconds(3600);
    }
}
