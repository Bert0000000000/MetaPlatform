package com.metaplatform.ea.governance.principle.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.principle.dto.CreatePrincipleCategoryRequest;
import com.metaplatform.ea.governance.principle.dto.PrincipleCategoryResponse;
import com.metaplatform.ea.governance.principle.dto.UpdatePrincipleCategoryRequest;
import com.metaplatform.ea.governance.principle.entity.PrincipleCategoryEntity;
import com.metaplatform.ea.governance.principle.repository.PrincipleCategoryRepository;
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
class PrincipleCategoryServiceTest {

    @Mock
    private PrincipleCategoryRepository repository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private PrincipleCategoryService service;

    private UUID categoryId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        categoryId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersistCategory() {
        CreatePrincipleCategoryRequest request = new CreatePrincipleCategoryRequest();
        request.setName("数据架构");
        request.setCode("DATA_ARCH");
        request.setSortOrder(1);

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "DATA_ARCH"))
                .thenReturn(false);
        ArgumentCaptor<PrincipleCategoryEntity> captor = ArgumentCaptor.forClass(PrincipleCategoryEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        PrincipleCategoryResponse response = service.create(request);

        assertThat(captor.getValue().getTenantId()).isEqualTo("tenant-default");
        assertThat(captor.getValue().getSortOrder()).isEqualTo(1);
        assertThat(response.getCode()).isEqualTo("DATA_ARCH");
    }

    @Test
    void create_shouldThrow_whenDuplicateCode() {
        CreatePrincipleCategoryRequest request = new CreatePrincipleCategoryRequest();
        request.setName("x");
        request.setCode("DATA_ARCH");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "DATA_ARCH"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("原则分类编码已存在");
    }

    @Test
    void list_shouldReturnTenantScoped() {
        PrincipleCategoryEntity entity = buildEntity(categoryId, "DATA_ARCH");
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<PrincipleCategoryResponse> result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCode()).isEqualTo("DATA_ARCH");
    }

    @Test
    void update_shouldChangeName() {
        PrincipleCategoryEntity entity = buildEntity(categoryId, "DATA_ARCH");
        when(repository.findByIdAndDeletedAtIsNull(categoryId)).thenReturn(Optional.of(entity));
        when(repository.save(any(PrincipleCategoryEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdatePrincipleCategoryRequest request = new UpdatePrincipleCategoryRequest();
        request.setName("数据架构（更新）");

        PrincipleCategoryResponse response = service.update(categoryId, request);

        assertThat(response.getName()).isEqualTo("数据架构（更新）");
    }

    @Test
    void delete_shouldSoftDelete() {
        PrincipleCategoryEntity entity = buildEntity(categoryId, "DATA_ARCH");
        when(repository.findByIdAndDeletedAtIsNull(categoryId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<PrincipleCategoryEntity> captor = ArgumentCaptor.forClass(PrincipleCategoryEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(categoryId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private PrincipleCategoryEntity buildEntity(UUID id, String code) {
        return PrincipleCategoryEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("数据架构")
                .code(code)
                .sortOrder(0)
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
