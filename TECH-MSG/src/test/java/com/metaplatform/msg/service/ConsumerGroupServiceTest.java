package com.metaplatform.msg.service;

import com.metaplatform.msg.common.MsgException;
import com.metaplatform.msg.dto.AckRequest;
import com.metaplatform.msg.dto.AckResponse;
import com.metaplatform.msg.dto.ConsumerGroupRequest;
import com.metaplatform.msg.dto.ConsumerGroupResponse;
import com.metaplatform.msg.entity.ConsumerGroupEntity;
import com.metaplatform.msg.repository.ConsumerGroupRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConsumerGroupServiceTest {

    @Mock
    private ConsumerGroupRepository consumerGroupRepository;

    @InjectMocks
    private ConsumerGroupService consumerGroupService;

    @Test
    void register_shouldCreateConsumerGroup_whenNotExists() {
        ConsumerGroupRequest request = ConsumerGroupRequest.builder()
                .tenantId("tenant-default")
                .groupId("order-processor-group")
                .topicName("metaplatform.User.USER_REGISTERED")
                .memberCount(3)
                .build();

        when(consumerGroupRepository.existsByTenantIdAndGroupIdAndTopicName(
                "tenant-default", "order-processor-group", "metaplatform.User.USER_REGISTERED"))
                .thenReturn(false);
        when(consumerGroupRepository.save(any(ConsumerGroupEntity.class)))
                .thenAnswer(inv -> {
                    ConsumerGroupEntity e = inv.getArgument(0);
                    return e;
                });

        ConsumerGroupResponse response = consumerGroupService.register(request);

        assertThat(response.getGroupId()).isEqualTo("order-processor-group");
        assertThat(response.getTopicName()).isEqualTo("metaplatform.User.USER_REGISTERED");
        assertThat(response.getMemberCount()).isEqualTo(3);
        assertThat(response.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void register_shouldThrow_whenConsumerGroupAlreadyExists() {
        ConsumerGroupRequest request = ConsumerGroupRequest.builder()
                .tenantId("tenant-default")
                .groupId("order-processor-group")
                .topicName("metaplatform.User.USER_REGISTERED")
                .build();

        when(consumerGroupRepository.existsByTenantIdAndGroupIdAndTopicName(
                "tenant-default", "order-processor-group", "metaplatform.User.USER_REGISTERED"))
                .thenReturn(true);

        assertThatThrownBy(() -> consumerGroupService.register(request))
                .isInstanceOf(MsgException.class)
                .hasMessageContaining("消费者组已存在");
    }

    @Test
    void ack_shouldUpdateConsumedOffset_whenConsumerGroupExists() {
        ConsumerGroupEntity entity = ConsumerGroupEntity.builder()
                .id("cg-1")
                .tenantId("tenant-default")
                .groupId("order-processor-group")
                .topicName("metaplatform.User.USER_REGISTERED")
                .memberCount(3)
                .consumedOffset(10L)
                .lag(5L)
                .status(ConsumerGroupEntity.ConsumerGroupStatus.ACTIVE)
                .build();

        AckRequest request = AckRequest.builder()
                .consumedOffset(15L)
                .lag(0L)
                .build();

        when(consumerGroupRepository.findById("cg-1")).thenReturn(Optional.of(entity));
        when(consumerGroupRepository.save(any(ConsumerGroupEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        AckResponse response = consumerGroupService.ack("cg-1", request);

        assertThat(response.getAcknowledged()).isTrue();
        assertThat(response.getConsumedOffset()).isEqualTo(15L);
        assertThat(response.getLag()).isEqualTo(0L);
        assertThat(entity.getConsumedOffset()).isEqualTo(15L);
    }

    @Test
    void unregister_shouldSetInactive_whenConsumerGroupExists() {
        ConsumerGroupEntity entity = ConsumerGroupEntity.builder()
                .id("cg-2")
                .groupId("test-group")
                .topicName("test-topic")
                .status(ConsumerGroupEntity.ConsumerGroupStatus.ACTIVE)
                .build();

        when(consumerGroupRepository.findById("cg-2")).thenReturn(Optional.of(entity));
        when(consumerGroupRepository.save(any(ConsumerGroupEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        consumerGroupService.unregister("cg-2");

        assertThat(entity.getStatus()).isEqualTo(ConsumerGroupEntity.ConsumerGroupStatus.INACTIVE);
        verify(consumerGroupRepository).save(entity);
    }

    @Test
    void get_shouldThrow_whenConsumerGroupNotFound() {
        when(consumerGroupRepository.findById("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> consumerGroupService.get("nonexistent"))
                .isInstanceOf(MsgException.class)
                .hasMessageContaining("消费者组不存在");
    }

    @Test
    void list_shouldReturnAllConsumerGroups() {
        ConsumerGroupEntity entity1 = ConsumerGroupEntity.builder()
                .id("cg-1")
                .tenantId("tenant-default")
                .groupId("group-1")
                .topicName("topic-1")
                .status(ConsumerGroupEntity.ConsumerGroupStatus.ACTIVE)
                .build();
        ConsumerGroupEntity entity2 = ConsumerGroupEntity.builder()
                .id("cg-2")
                .tenantId("tenant-default")
                .groupId("group-2")
                .topicName("topic-2")
                .status(ConsumerGroupEntity.ConsumerGroupStatus.ACTIVE)
                .build();

        when(consumerGroupRepository.findAll()).thenReturn(List.of(entity1, entity2));

        var result = consumerGroupService.list("tenant-default", 1, 20);

        assertThat(result.getItems()).hasSize(2);
        assertThat(result.getTotal()).isEqualTo(2);
    }
}
