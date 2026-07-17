package com.metaplatform.wfe.taskoperation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.taskoperation.dto.EventSubscriptionRequest;
import com.metaplatform.wfe.taskoperation.dto.EventSubscriptionResponse;
import com.metaplatform.wfe.taskoperation.entity.EventSubscriptionEntity;
import com.metaplatform.wfe.taskoperation.repository.EventSubscriptionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventSubscriptionServiceTest {

    @Mock
    private EventSubscriptionRepository repository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private EventSubscriptionService service;

    @BeforeEach
    void setUp() {
        service = new EventSubscriptionService(repository, objectMapper);
        TenantContext.set("tenant-default");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private EventSubscriptionEntity sampleEntity(String id) {
        Instant now = Instant.now();
        return EventSubscriptionEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .userId("user-001")
                .eventTypes("[\"TASK_COMPLETED\",\"TASK_REJECTED\"]")
                .callbackUrl("https://example.com/cb")
                .enabled(true)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    @Test
    void create_subscription_success() throws Exception {
        when(repository.save(any(EventSubscriptionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        com.metaplatform.wfe.security.JwtAuthenticationToken token =
                new com.metaplatform.wfe.security.JwtAuthenticationToken(
                        "user-001", "user-001", "tenant-default", List.of("USER"));
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(token);

        EventSubscriptionRequest request = new EventSubscriptionRequest();
        request.setEventTypes(List.of("TASK_COMPLETED"));
        request.setCallbackUrl("https://example.com/cb");

        EventSubscriptionResponse response = service.create(request);
        assertThat(response.getCallbackUrl()).isEqualTo("https://example.com/cb");
        assertThat(response.getEventTypes()).contains("TASK_COMPLETED");

        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    @Test
    void delete_throws_when_not_found() {
        when(repository.findByIdAndTenantId("missing", "tenant-default")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete("missing"))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NOT_FOUND);
    }

    @Test
    void list_mine_returns_user_subscriptions() {
        when(repository.findByTenantIdAndUserId("tenant-default", "user-001"))
                .thenReturn(List.of(sampleEntity("sub-1")));

        com.metaplatform.wfe.security.JwtAuthenticationToken token =
                new com.metaplatform.wfe.security.JwtAuthenticationToken(
                        "user-001", "user-001", "tenant-default", List.of("USER"));
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(token);

        List<EventSubscriptionResponse> list = service.listMine();
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getEventTypes()).contains("TASK_COMPLETED");

        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }
}