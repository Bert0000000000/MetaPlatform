package com.metaplatform.msg.service;

import com.metaplatform.msg.common.PageResponse;
import com.metaplatform.msg.dto.OutboxResponse;
import com.metaplatform.msg.dto.OutboxStatsResponse;
import com.metaplatform.msg.entity.OutboxMessageEntity;
import com.metaplatform.msg.repository.OutboxMessageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OutboxServiceTest {

    @Mock
    private OutboxMessageRepository outboxRepository;

    @Mock
    private OutboxRelayService outboxRelayService;

    @InjectMocks
    private OutboxService outboxService;

    @Test
    void getStats_shouldReturnCorrectCounts() {
        when(outboxRepository.countByStatus()).thenReturn(List.of(
                new Object[]{OutboxMessageEntity.OutboxStatus.PENDING, 5L},
                new Object[]{OutboxMessageEntity.OutboxStatus.SENT, 10L},
                new Object[]{OutboxMessageEntity.OutboxStatus.FAILED, 2L}
        ));

        OutboxStatsResponse stats = outboxService.getStats();

        assertThat(stats.getPending()).isEqualTo(5);
        assertThat(stats.getSent()).isEqualTo(10);
        assertThat(stats.getFailed()).isEqualTo(2);
        assertThat(stats.getTotal()).isEqualTo(17);
    }

    @Test
    void listOutbox_shouldReturnPagedResults_whenStatusProvided() {
        OutboxMessageEntity entity = buildOutboxMessage("msg-1", "PENDING");
        Page<OutboxMessageEntity> page = new PageImpl<>(List.of(entity), PageRequest.of(0, 20), 1);
        when(outboxRepository.findByStatus(eq(OutboxMessageEntity.OutboxStatus.PENDING), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<OutboxResponse> result = outboxService.listOutbox("PENDING", 1, 20);

        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getTotal()).isEqualTo(1);
        assertThat(result.getPage()).isEqualTo(1);
        assertThat(result.getItems().get(0).getId()).isEqualTo("msg-1");
    }

    @Test
    void getOutbox_shouldReturnResponse_whenIdExists() {
        OutboxMessageEntity entity = buildOutboxMessage("msg-2", "SENT");
        when(outboxRepository.findById("msg-2")).thenReturn(Optional.of(entity));

        OutboxResponse response = outboxService.getOutbox("msg-2");

        assertThat(response.getId()).isEqualTo("msg-2");
        assertThat(response.getStatus()).isEqualTo("SENT");
    }

    private OutboxMessageEntity buildOutboxMessage(String id, String status) {
        Map<String, Object> headers = new HashMap<>();
        headers.put("X-Trace-Id", "trace-" + id);

        Map<String, Object> payload = new HashMap<>();
        payload.put("test", true);

        return OutboxMessageEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .aggregateType("User")
                .aggregateId("agg-" + id)
                .eventType("USER_REGISTERED")
                .payload(payload)
                .headers(headers)
                .status(OutboxMessageEntity.OutboxStatus.valueOf(status))
                .retryCount(0)
                .maxRetries(3)
                .createdAt(Instant.now())
                .build();
    }
}
