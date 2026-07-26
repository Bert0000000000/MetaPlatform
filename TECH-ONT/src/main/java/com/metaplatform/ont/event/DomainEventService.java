package com.metaplatform.ont.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.metaplatform.msg.topology.TopologyTopics;

/**
 * Domain Event Service（P1.1.5 + Phase 7 联动）。
 *
 * <p>负责：</p>
 * <ul>
 *   <li>写入 ont_domain_event 表</li>
 *   <li>发布到 Kafka {@link TopologyTopics#ONTOLOGY_DOMAIN_EVENT} topic</li>
 *   <li>提供事件查询接口供 Trigger Engine 使用</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DomainEventService {

    private final DomainEventRepository repository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public DomainEventEntity publish(String tenantId, String eventCode, String conceptCode,
                                      String objectId, Map<String, Object> payload) {
        DomainEventEntity e = DomainEventEntity.builder()
                .id("EVT-" + UUID.randomUUID())
                .tenantId(tenantId == null ? "tenant-default" : tenantId)
                .eventCode(eventCode)
                .conceptCode(conceptCode)
                .objectId(objectId)
                .payload(payload == null ? null : payload.toString())
                .occurredAt(Instant.now())
                .consumed(false)
                .build();
        DomainEventEntity saved = repository.save(e);
        // 同步发到 Kafka，供 Phase 7 Trigger Engine 实时消费
        kafkaTemplate.send(TopologyTopics.ONTOLOGY_DOMAIN_EVENT, saved.getObjectId(), saved);
        log.info("[DomainEvent] published eventCode={} concept={} objectId={}",
                eventCode, conceptCode, objectId);
        return saved;
    }

    public List<DomainEventEntity> listByEventCode(String tenantId, String eventCode) {
        return repository.findByTenantIdAndEventCodeOrderByOccurredAtDesc(tenantId, eventCode);
    }

    public List<DomainEventEntity> listPending(String tenantId) {
        return repository.findByTenantIdAndConsumedFalse(tenantId);
    }

    public void markConsumed(String id) {
        repository.findById(id).ifPresent(e -> {
            e.setConsumed(true);
            repository.save(e);
        });
    }
}
