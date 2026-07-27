package com.metaplatform.ea.review.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.review.dto.ArchitectureReviewResponse;
import com.metaplatform.ea.review.dto.CreateArchitectureReviewRequest;
import com.metaplatform.ea.review.dto.ReviewActionRequest;
import com.metaplatform.ea.review.dto.UpdateArchitectureReviewRequest;
import com.metaplatform.ea.review.entity.ArchitectureReviewEntity;
import com.metaplatform.ea.review.repository.ArchitectureReviewRepository;
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
class ArchitectureReviewServiceTest {

    @Mock
    private ArchitectureReviewRepository repository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ArchitectureReviewService service;

    private UUID reviewId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        reviewId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersistAsDraft() {
        CreateArchitectureReviewRequest request = new CreateArchitectureReviewRequest();
        request.setTitle("订单服务架构评审");
        request.setReviewType("APPLICATION");
        request.setSummary("评审订单服务的整体架构");
        request.setReviewer("architect-1");

        ArgumentCaptor<ArchitectureReviewEntity> captor = ArgumentCaptor.forClass(ArchitectureReviewEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        ArchitectureReviewResponse response = service.create(request);

        assertThat(captor.getValue().getStatus()).isEqualTo("DRAFT");
        assertThat(captor.getValue().getTenantId()).isEqualTo("tenant-default");
        assertThat(captor.getValue().getReviewType()).isEqualTo("APPLICATION");
        assertThat(response.getStatus()).isEqualTo("DRAFT");
    }

    @Test
    void create_shouldThrow_whenReviewTypeInvalid() {
        CreateArchitectureReviewRequest request = new CreateArchitectureReviewRequest();
        request.setTitle("x");
        request.setReviewType("INVALID_TYPE");

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("reviewType");
    }

    @Test
    void submit_shouldTransitionToSubmitted() {
        ArchitectureReviewEntity entity = buildEntity(reviewId, "DRAFT");
        when(repository.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<ArchitectureReviewEntity> captor = ArgumentCaptor.forClass(ArchitectureReviewEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        ReviewActionRequest request = new ReviewActionRequest();
        request.setComment("提交评审");
        request.setReviewer("architect-1");

        ArchitectureReviewResponse response = service.submit(reviewId, request);

        assertThat(response.getStatus()).isEqualTo("SUBMITTED");
        assertThat(captor.getValue().getSubmittedAt()).isNotNull();
        assertThat(captor.getValue().getComments()).contains("SUBMIT");
    }

    @Test
    void submit_shouldThrow_whenNotDraft() {
        ArchitectureReviewEntity entity = buildEntity(reviewId, "APPROVED");
        when(repository.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.of(entity));

        ReviewActionRequest request = new ReviewActionRequest();
        request.setComment("test");

        assertThatThrownBy(() -> service.submit(reviewId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("DRAFT");
    }

    @Test
    void approve_shouldTransitionToApproved() {
        ArchitectureReviewEntity entity = buildEntity(reviewId, "SUBMITTED");
        when(repository.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<ArchitectureReviewEntity> captor = ArgumentCaptor.forClass(ArchitectureReviewEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        ReviewActionRequest request = new ReviewActionRequest();
        request.setComment("架构合理，同意上线");
        request.setDecision("APPROVED");
        request.setReviewer("cto");

        ArchitectureReviewResponse response = service.approve(reviewId, request);

        assertThat(response.getStatus()).isEqualTo("APPROVED");
        assertThat(captor.getValue().getDecision()).isEqualTo("APPROVED");
        assertThat(captor.getValue().getDecidedAt()).isNotNull();
    }

    @Test
    void reject_shouldTransitionToRejected() {
        ArchitectureReviewEntity entity = buildEntity(reviewId, "SUBMITTED");
        when(repository.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<ArchitectureReviewEntity> captor = ArgumentCaptor.forClass(ArchitectureReviewEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        ReviewActionRequest request = new ReviewActionRequest();
        request.setComment("数据落地方式有风险");
        request.setDecision("REJECTED");

        ArchitectureReviewResponse response = service.reject(reviewId, request);

        assertThat(response.getStatus()).isEqualTo("REJECTED");
        assertThat(captor.getValue().getDecision()).isEqualTo("REJECTED");
    }

    @Test
    void update_shouldThrow_whenTerminal() {
        ArchitectureReviewEntity entity = buildEntity(reviewId, "APPROVED");
        when(repository.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.of(entity));

        UpdateArchitectureReviewRequest request = new UpdateArchitectureReviewRequest();
        request.setSummary("trying to modify");

        assertThatThrownBy(() -> service.update(reviewId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("评审已结束");
    }

    @Test
    void addComment_shouldAppendJsonNode() {
        ArchitectureReviewEntity entity = buildEntity(reviewId, "SUBMITTED");
        when(repository.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<ArchitectureReviewEntity> captor = ArgumentCaptor.forClass(ArchitectureReviewEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        ReviewActionRequest request = new ReviewActionRequest();
        request.setComment("补充问题");
        request.setReviewer("reviewer-1");

        ArchitectureReviewResponse response = service.addComment(reviewId, request);

        assertThat(response.getComments()).contains("COMMENT");
        assertThat(captor.getValue().getComments()).contains("补充问题");
    }

    @Test
    void list_shouldFilterByStatus() {
        ArchitectureReviewEntity entity = buildEntity(reviewId, "DRAFT");
        when(repository.findByTenantIdAndStatusAndDeletedAtIsNull("tenant-default", "DRAFT"))
                .thenReturn(List.of(entity));

        List<ArchitectureReviewResponse> result = service.list("DRAFT", null, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStatus()).isEqualTo("DRAFT");
    }

    @Test
    void get_shouldThrow_whenTenantMismatch() {
        ArchitectureReviewEntity entity = buildEntity(reviewId, "DRAFT");
        entity.setTenantId("tenant-other");
        when(repository.findByIdAndDeletedAtIsNull(reviewId)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> service.get(reviewId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("架构评审不存在");
    }

    private ArchitectureReviewEntity buildEntity(UUID id, String status) {
        Instant now = Instant.now();
        return ArchitectureReviewEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .title("订单服务架构评审")
                .reviewType("APPLICATION")
                .status(status)
                .comments("[]")
                .attachments("[]")
                .metadata("{}")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}