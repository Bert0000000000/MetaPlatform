package com.metaplatform.ea.governance.review.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.review.dto.*;
import com.metaplatform.ea.governance.review.entity.ReviewTemplateEntity;
import com.metaplatform.ea.governance.review.entity.ReviewTicketEntity;
import com.metaplatform.ea.governance.review.repository.ReviewTemplateRepository;
import com.metaplatform.ea.governance.review.repository.ReviewTicketRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReviewTicketServiceTest {

    @Mock
    private ReviewTicketRepository repository;

    @Mock
    private ReviewTemplateRepository templateRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ReviewTicketService service;

    private UUID ticketId;
    private UUID templateId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        ticketId = UUID.randomUUID();
        templateId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersistAsCreated() {
        CreateReviewTicketRequest request = new CreateReviewTicketRequest();
        request.setTitle("订单服务评审");
        request.setTemplateId(templateId);
        request.setApplicant("developer-1");

        when(templateRepository.findByIdAndDeletedAtIsNull(templateId))
                .thenReturn(Optional.of(buildTemplate(templateId)));
        ArgumentCaptor<ReviewTicketEntity> captor = ArgumentCaptor.forClass(ReviewTicketEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        ReviewTicketResponse response = service.create(request);

        assertThat(captor.getValue().getStatus()).isEqualTo("CREATED");
        assertThat(response.getStatus()).isEqualTo("CREATED");
    }

    @Test
    void startReview_shouldTransitionToReviewing() {
        ReviewTicketEntity entity = buildEntity(ticketId, "CREATED");
        when(repository.findByIdAndDeletedAtIsNull(ticketId)).thenReturn(Optional.of(entity));
        when(repository.save(any(ReviewTicketEntity.class))).thenAnswer(i -> i.getArgument(0));

        ReviewTicketResponse response = service.startReview(ticketId, "architect-1");

        assertThat(response.getStatus()).isEqualTo("REVIEWING");
        assertThat(response.getReviewer()).isEqualTo("architect-1");
    }

    @Test
    void approve_shouldTransitionToApproved() {
        ReviewTicketEntity entity = buildEntity(ticketId, "REVIEWING");
        when(repository.findByIdAndDeletedAtIsNull(ticketId)).thenReturn(Optional.of(entity));
        when(repository.save(any(ReviewTicketEntity.class))).thenAnswer(i -> i.getArgument(0));

        ReviewTicketScoreRequest request = new ReviewTicketScoreRequest();
        request.setReviewer("cto");
        ReviewScoreItemRequest score = new ReviewScoreItemRequest();
        score.setDimension("可扩展性");
        score.setScore(95);
        request.setScores(List.of(score));
        request.setComment("符合架构规范");
        request.setDecision("通过");

        ReviewTicketResponse response = service.approve(ticketId, request);

        assertThat(response.getStatus()).isEqualTo("APPROVED");
        assertThat(response.getDecision()).isEqualTo("通过");
    }

    @Test
    void reject_shouldTransitionToRejected() {
        ReviewTicketEntity entity = buildEntity(ticketId, "REVIEWING");
        when(repository.findByIdAndDeletedAtIsNull(ticketId)).thenReturn(Optional.of(entity));
        when(repository.save(any(ReviewTicketEntity.class))).thenAnswer(i -> i.getArgument(0));

        ReviewTicketScoreRequest request = new ReviewTicketScoreRequest();
        request.setReviewer("architect-1");
        request.setComment("数据一致性方案需补充");

        ReviewTicketResponse response = service.reject(ticketId, request);

        assertThat(response.getStatus()).isEqualTo("REJECTED");
    }

    @Test
    void approve_shouldThrow_whenNotReviewing() {
        ReviewTicketEntity entity = buildEntity(ticketId, "CREATED");
        when(repository.findByIdAndDeletedAtIsNull(ticketId)).thenReturn(Optional.of(entity));

        ReviewTicketScoreRequest request = new ReviewTicketScoreRequest();
        request.setReviewer("cto");
        request.setComment("test");

        assertThatThrownBy(() -> service.approve(ticketId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("REVIEWING");
    }

    @Test
    void list_shouldFilterByStatus() {
        ReviewTicketEntity entity = buildEntity(ticketId, "REVIEWING");
        when(repository.findByTenantIdAndStatusAndDeletedAtIsNull("tenant-default", "REVIEWING"))
                .thenReturn(List.of(entity));

        List<ReviewTicketResponse> result = service.list("REVIEWING");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStatus()).isEqualTo("REVIEWING");
    }

    private ReviewTemplateEntity buildTemplate(UUID id) {
        return ReviewTemplateEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("架构评审模板")
                .code("ARCH_REVIEW_V1")
                .dimensions("[]")
                .experts("[]")
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    private ReviewTicketEntity buildEntity(UUID id, String status) {
        return ReviewTicketEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .title("订单服务评审")
                .templateId(templateId)
                .status(status)
                .scores("[]")
                .comments("[]")
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
