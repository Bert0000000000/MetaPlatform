package com.metaplatform.ea.governance.review.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.review.dto.CreateReviewTemplateRequest;
import com.metaplatform.ea.governance.review.dto.ReviewDimensionRequest;
import com.metaplatform.ea.governance.review.dto.ReviewExpertRequest;
import com.metaplatform.ea.governance.review.dto.ReviewTemplateResponse;
import com.metaplatform.ea.governance.review.entity.ReviewTemplateEntity;
import com.metaplatform.ea.governance.review.repository.ReviewTemplateRepository;
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
class ReviewTemplateServiceTest {

    @Mock
    private ReviewTemplateRepository repository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ReviewTemplateService service;

    private UUID templateId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        templateId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersistTemplateWithDimensionsAndExperts() {
        CreateReviewTemplateRequest request = new CreateReviewTemplateRequest();
        request.setName("架构评审模板");
        request.setCode("ARCH_REVIEW_V1");
        ReviewDimensionRequest dimension = new ReviewDimensionRequest();
        dimension.setName("可扩展性");
        dimension.setWeight(30);
        dimension.setMaxScore(100);
        request.setDimensions(List.of(dimension));
        ReviewExpertRequest expert = new ReviewExpertRequest();
        expert.setUserId("arch-1");
        expert.setName("张三");
        expert.setRole("架构师");
        request.setExperts(List.of(expert));

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "ARCH_REVIEW_V1"))
                .thenReturn(false);
        ArgumentCaptor<ReviewTemplateEntity> captor = ArgumentCaptor.forClass(ReviewTemplateEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        ReviewTemplateResponse response = service.create(request);

        assertThat(response.getCode()).isEqualTo("ARCH_REVIEW_V1");
        assertThat(captor.getValue().getDimensions()).contains("可扩展性");
        assertThat(captor.getValue().getExperts()).contains("arch-1");
    }

    @Test
    void create_shouldThrow_whenDuplicateCode() {
        CreateReviewTemplateRequest request = new CreateReviewTemplateRequest();
        request.setName("x");
        request.setCode("TEMP-001");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "TEMP-001"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("评审模板编码已存在");
    }

    @Test
    void list_shouldReturnTenantScoped() {
        ReviewTemplateEntity entity = buildEntity(templateId, "ARCH_REVIEW_V1");
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<ReviewTemplateResponse> result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCode()).isEqualTo("ARCH_REVIEW_V1");
    }

    @Test
    void delete_shouldSoftDelete() {
        ReviewTemplateEntity entity = buildEntity(templateId, "ARCH_REVIEW_V1");
        when(repository.findByIdAndDeletedAtIsNull(templateId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<ReviewTemplateEntity> captor = ArgumentCaptor.forClass(ReviewTemplateEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(templateId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private ReviewTemplateEntity buildEntity(UUID id, String code) {
        return ReviewTemplateEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("架构评审模板")
                .code(code)
                .dimensions("[]")
                .experts("[]")
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
