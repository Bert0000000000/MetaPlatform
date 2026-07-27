package com.metaplatform.obs.rune;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * RunEvent 服务（P8.2）。
 *
 * <p>从 Kafka 消费 14 个 Ontology Event + Agent 事件 Topic，统一入 obs_run_event。
 * 同时被 TECH-AGENT / TECH-ACTION / TECH-ONT 通过 RestClient 写入。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RunEventService {

    private final RunEventRepository repository;

    /**
     * 统一事件接收（任一 Topic 都进入 RunEvent）。
     * 注意：KafkaListener 注解由 TECH-MSG @EventTopicListener 自动注册，
     * 这里只保留 service 方法供其他服务直接调用。
     */
    public RunEventEntity record(String tenantId, String runId, String type,
                                  String payload, String traceId) {
        RunEventEntity e = RunEventEntity.builder()
                .id("EVT-" + UUID.randomUUID())
                .tenantId(tenantId == null ? "tenant-default" : tenantId)
                .runId(runId == null ? "unknown" : runId)
                .type(type)
                .payload(payload)
                .ts(Instant.now())
                .traceId(traceId)
                .build();
        return repository.save(e);
    }

    public java.util.List<RunEventEntity> listByRun(String runId) {
        return repository.findByRunIdOrderByTsAsc(runId);
    }

    /**
     * 兜底 Kafka 监听：把所有 ontology.* / agent.* / wfe.* / kb.* 事件落 RunEvent。
     */
    @KafkaListener(topicPattern = "ontology.*|agent.*|wfe.*|kb.*", groupId = "obs-run-event-collector")
    public void onEvent(Object payload) {
        try {
            String s = String.valueOf(payload);
            // 简化：从 payload 字符串抽取 type + runId（生产用专用反序列化）
            String type = extract(s, "\"type\":\"", "\"");
            String runId = extract(s, "\"runId\":\"", "\"");
            String tenantId = extract(s, "\"tenantId\":\"", "\"");
            record(tenantId, runId, type, s, null);
        } catch (Exception e) {
            log.warn("[RunEventService] onEvent parse failed: {}", e.getMessage());
        }
    }

    private String extract(String s, String start, String end) {
        int i = s.indexOf(start);
        if (i < 0) return "UNKNOWN";
        int j = s.indexOf(end, i + start.length());
        return j < 0 ? "UNKNOWN" : s.substring(i + start.length(), j);
    }
}
