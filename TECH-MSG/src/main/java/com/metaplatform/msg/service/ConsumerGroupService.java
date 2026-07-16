package com.metaplatform.msg.service;

import com.metaplatform.msg.common.ErrorCode;
import com.metaplatform.msg.common.MsgException;
import com.metaplatform.msg.common.PageResponse;
import com.metaplatform.msg.dto.AckRequest;
import com.metaplatform.msg.dto.AckResponse;
import com.metaplatform.msg.dto.ConsumerGroupRequest;
import com.metaplatform.msg.dto.ConsumerGroupResponse;
import com.metaplatform.msg.entity.ConsumerGroupEntity;
import com.metaplatform.msg.repository.ConsumerGroupRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConsumerGroupService {

    private final ConsumerGroupRepository consumerGroupRepository;

    @Transactional
    public ConsumerGroupResponse register(ConsumerGroupRequest request) {
        String tenantId = resolveTenantId(request.getTenantId());

        if (consumerGroupRepository.existsByTenantIdAndGroupIdAndTopicName(
                tenantId, request.getGroupId(), request.getTopicName())) {
            throw new MsgException(ErrorCode.CONSUMER_GROUP_ALREADY_EXISTS,
                    "消费者组已存在: groupId=" + request.getGroupId() + ", topic=" + request.getTopicName());
        }

        ConsumerGroupEntity entity = ConsumerGroupEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .groupId(request.getGroupId())
                .topicName(request.getTopicName())
                .memberCount(request.getMemberCount() != null ? request.getMemberCount() : 0)
                .consumedOffset(0L)
                .lag(0L)
                .status(ConsumerGroupEntity.ConsumerGroupStatus.ACTIVE)
                .build();

        entity = consumerGroupRepository.save(entity);
        log.info("Consumer group registered: id={}, groupId={}, topic={}",
                entity.getId(), entity.getGroupId(), entity.getTopicName());

        return ConsumerGroupResponse.from(entity);
    }

    public PageResponse<ConsumerGroupResponse> list(String tenantId, int page, int size) {
        String effectiveTenantId = resolveTenantId(tenantId);

        List<ConsumerGroupEntity> all = consumerGroupRepository.findAll().stream()
                .filter(cg -> effectiveTenantId == null || effectiveTenantId.equals(cg.getTenantId()))
                .toList();

        int start = (page - 1) * size;
        int end = Math.min(start + size, all.size());
        List<ConsumerGroupResponse> items = all.subList(start, end).stream()
                .map(ConsumerGroupResponse::from)
                .toList();

        return PageResponse.<ConsumerGroupResponse>builder()
                .items(items)
                .total(all.size())
                .page(page)
                .size(size)
                .totalPages((int) Math.ceil((double) all.size() / size))
                .build();
    }

    public ConsumerGroupResponse get(String id) {
        ConsumerGroupEntity entity = findById(id);
        return ConsumerGroupResponse.from(entity);
    }

    @Transactional
    public void unregister(String id) {
        ConsumerGroupEntity entity = findById(id);
        entity.setStatus(ConsumerGroupEntity.ConsumerGroupStatus.INACTIVE);
        consumerGroupRepository.save(entity);
        log.info("Consumer group unregistered: id={}, groupId={}", id, entity.getGroupId());
    }

    @Transactional
    public AckResponse ack(String id, AckRequest request) {
        ConsumerGroupEntity entity = findById(id);

        entity.setConsumedOffset(request.getConsumedOffset());
        if (request.getLag() != null) {
            entity.setLag(request.getLag());
        } else {
            entity.setLag(0L);
        }

        consumerGroupRepository.save(entity);
        log.info("Consumer group ack: id={}, groupId={}, offset={}",
                id, entity.getGroupId(), request.getConsumedOffset());

        return AckResponse.builder()
                .consumerGroupId(id)
                .acknowledged(true)
                .consumedOffset(request.getConsumedOffset())
                .lag(entity.getLag())
                .ackedAt(Instant.now())
                .build();
    }

    @Transactional
    public void updateLag(String id, long lag) {
        ConsumerGroupEntity entity = findById(id);
        entity.setLag(lag);
        consumerGroupRepository.save(entity);
    }

    private ConsumerGroupEntity findById(String id) {
        return consumerGroupRepository.findById(id)
                .orElseThrow(() -> new MsgException(ErrorCode.CONSUMER_GROUP_NOT_FOUND,
                        "消费者组不存在: " + id));
    }

    private String resolveTenantId(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            return "tenant-default";
        }
        return tenantId;
    }
}
