package com.metaplatform.msg.service;

import com.metaplatform.msg.entity.ConsumerGroupEntity;
import com.metaplatform.msg.repository.ConsumerGroupRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.ListConsumerGroupOffsetsOptions;
import org.apache.kafka.clients.admin.ListConsumerGroupOffsetsResult;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConsumerGroupMonitorService {

    private final ConsumerGroupRepository consumerGroupRepository;
    private final AdminClient kafkaAdminClient;

    @Value("${app.msg.consumer-group.monitor-interval-ms:30000}")
    private long monitorIntervalMs;

    @Scheduled(fixedDelayString = "${app.msg.consumer-group.monitor-interval-ms:30000}")
    public void refreshLag() {
        java.util.List<ConsumerGroupEntity> activeGroups = consumerGroupRepository.findAll().stream()
                .filter(cg -> cg.getStatus() == ConsumerGroupEntity.ConsumerGroupStatus.ACTIVE)
                .toList();

        for (ConsumerGroupEntity group : activeGroups) {
            try {
                long lag = queryLagFromKafka(group.getGroupId(), group.getTopicName());
                group.setLag(lag);
                consumerGroupRepository.save(group);
                log.debug("Refreshed lag for groupId={}, topic={}, lag={}",
                        group.getGroupId(), group.getTopicName(), lag);
            } catch (Exception e) {
                log.warn("Failed to refresh lag for groupId={}, topic={}: {}",
                        group.getGroupId(), group.getTopicName(), e.getMessage());
            }
        }
    }

    public long queryLagFromKafka(String groupId, String topicName) {
        try {
            ListConsumerGroupOffsetsResult offsetsResult = kafkaAdminClient.listConsumerGroupOffsets(groupId);
            Map<TopicPartition, OffsetAndMetadata> offsets = offsetsResult.partitionsToOffsetAndMetadata()
                    .get(10, TimeUnit.SECONDS);

            long totalLag = 0;
            for (Map.Entry<TopicPartition, OffsetAndMetadata> entry : offsets.entrySet()) {
                if (topicName.equals(entry.getKey().topic())) {
                    OffsetAndMetadata metadata = entry.getValue();
                    totalLag += metadata.offset();
                }
            }
            return totalLag;
        } catch (Exception e) {
            log.warn("Failed to query lag from Kafka for groupId={}: {}", groupId, e.getMessage());
            return 0L;
        }
    }
}
