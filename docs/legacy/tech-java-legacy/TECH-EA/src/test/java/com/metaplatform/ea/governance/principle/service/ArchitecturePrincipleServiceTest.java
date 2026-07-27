package com.metaplatform.ea.governance.principle.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.principle.dto.ArchitecturePrincipleResponse;
import com.metaplatform.ea.governance.principle.dto.CreateArchitecturePrincipleRequest;
import com.metaplatform.ea.governance.principle.dto.UpdateArchitecturePrincipleRequest;
import com.metaplatform.ea.governance.principle.entity.ArchitecturePrincipleEntity;
import com.metaplatform.ea.governance.principle.entity.PrincipleCategoryEntity;
import com.metaplatform.ea.governance.principle.repository.ArchitecturePrincipleRepository;
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
class ArchitecturePrincipleServiceTest {

    @Mock
    private ArchitecturePrincipleRepository repository;

    @Mock
    private PrincipleCategoryRepository categoryRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ArchitecturePrincipleService service;

    private UUID principleId;
    private UUID categoryId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        principleId = UUID.randomUUID();
        categoryId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersistPrinciple() {
        CreateArchitecturePrincipleRequest request = new CreateArchitecturePrincipleRequest();
        request.setName("服务自治");
        request.setCode("SERVICE_AUTONOMY");
        request.setCategoryId(categoryId);
        request.setPriority("high");
        request.setStandards(List.of("每个服务独立部署", "服务间通过 API 通信"));

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "SERVICE_AUTONOMY"))
                .thenReturn(false);
        when(categoryRepository.findByIdAndDeletedAtIsNull(categoryId))
                .thenReturn(Optional.of(buildCategory(categoryId)));
        ArgumentCaptor<ArchitecturePrincipleEntity> captor = ArgumentCaptor.forClass(ArchitecturePrincipleEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        ArchitecturePrincipleResponse response = service.create(request);

        assertThat(captor.getValue().getPriority()).isEqualTo("HIGH");
        assertThat(captor.getValue().getCategoryId()).isEqualTo(categoryId);
        assertThat(response.getCode()).isEqualTo("SERVICE_AUTONOMY");
    }

    @Test
    void create_shouldThrow_whenInvalidPriority() {
        CreateArchitecturePrincipleRequest request = new CreateArchitecturePrincipleRequest();
        request.setName("x");
        request.setCode("PRIN-001");
        request.setPriority("INVALID");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "PRIN-001"))
                .thenReturn(false);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("priority");
    }

    @Test
    void list_shouldFilterByCategory() {
        ArchitecturePrincipleEntity entity = buildEntity(principleId, "SERVICE_AUTONOMY", categoryId);
        when(repository.findByTenantIdAndCategoryIdAndDeletedAtIsNull("tenant-default", categoryId))
                .thenReturn(List.of(entity));
        when(categoryRepository.findByIdAndDeletedAtIsNull(categoryId))
                .thenReturn(Optional.of(buildCategory(categoryId)));

        List<ArchitecturePrincipleResponse> result = service.list(categoryId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCategoryId()).isEqualTo(categoryId);
    }

    @Test
    void update_shouldChangeStatus() {
        ArchitecturePrincipleEntity entity = buildEntity(principleId, "SERVICE_AUTONOMY", null);
        when(repository.findByIdAndDeletedAtIsNull(principleId)).thenReturn(Optional.of(entity));
        when(repository.save(any(ArchitecturePrincipleEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateArchitecturePrincipleRequest request = new UpdateArchitecturePrincipleRequest();
        request.setStatus("inactive");

        ArchitecturePrincipleResponse response = service.update(principleId, request);

        assertThat(response.getStatus()).isEqualTo("INACTIVE");
    }

    @Test
    void delete_shouldSoftDelete() {
        ArchitecturePrincipleEntity entity = buildEntity(principleId, "SERVICE_AUTONOMY", null);
        when(repository.findByIdAndDeletedAtIsNull(principleId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<ArchitecturePrincipleEntity> captor = ArgumentCaptor.forClass(ArchitecturePrincipleEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(principleId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private PrincipleCategoryEntity buildCategory(UUID id) {
        return PrincipleCategoryEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("数据架构")
                .code("DATA_ARCH")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    private ArchitecturePrincipleEntity buildEntity(UUID id, String code, UUID categoryId) {
        return ArchitecturePrincipleEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("服务自治")
                .code(code)
                .categoryId(categoryId)
                .priority("HIGH")
                .status("ACTIVE")
                .standards("[]")
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
