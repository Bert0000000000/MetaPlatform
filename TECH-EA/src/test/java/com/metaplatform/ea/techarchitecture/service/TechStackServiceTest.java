package com.metaplatform.ea.techarchitecture.service;

import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techarchitecture.dto.CreateTechStackRequest;
import com.metaplatform.ea.techarchitecture.dto.TechStackResponse;
import com.metaplatform.ea.techarchitecture.dto.UpdateTechStackRequest;
import com.metaplatform.ea.techarchitecture.entity.TechStackEntity;
import com.metaplatform.ea.techarchitecture.repository.TechStackRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
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
class TechStackServiceTest {

    @Mock
    private TechStackRepository repository;

    @InjectMocks
    private TechStackService service;

    private UUID techStackId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        techStackId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldDefaultLifecycleStatus_whenNotProvided() {
        CreateTechStackRequest request = new CreateTechStackRequest();
        request.setName("PostgreSQL");
        request.setCode("POSTGRES_15");
        request.setCategory("DATABASE");
        request.setVendor("PostgreSQL Global Development Group");
        request.setVersion("15.4");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "POSTGRES_15"))
                .thenReturn(false);
        ArgumentCaptor<TechStackEntity> captor = ArgumentCaptor.forClass(TechStackEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        TechStackResponse response = service.create(request);

        assertThat(captor.getValue().getLifecycleStatus()).isEqualTo("ACTIVE");
        assertThat(captor.getValue().getMetadata()).isEqualTo("{}");
        assertThat(response.getCode()).isEqualTo("POSTGRES_15");
    }

    @Test
    void create_shouldThrow_whenDuplicateCode() {
        CreateTechStackRequest request = new CreateTechStackRequest();
        request.setName("PostgreSQL");
        request.setCode("POSTGRES_15");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "POSTGRES_15"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("技术栈编码已存在");
    }

    @Test
    void list_shouldReturnTenantScopedStacks() {
        TechStackEntity entity = buildEntity(techStackId, "POSTGRES_15");
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<TechStackResponse> result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCode()).isEqualTo("POSTGRES_15");
    }

    @Test
    void update_shouldChangeLifecycleStatus() {
        TechStackEntity entity = buildEntity(techStackId, "POSTGRES_15");
        when(repository.findByIdAndDeletedAtIsNull(techStackId)).thenReturn(Optional.of(entity));
        when(repository.save(any(TechStackEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateTechStackRequest request = new UpdateTechStackRequest();
        request.setLifecycleStatus("DEPRECATED");
        request.setVersion("14.10");

        TechStackResponse response = service.update(techStackId, request);

        assertThat(response.getLifecycleStatus()).isEqualTo("DEPRECATED");
        assertThat(response.getVersion()).isEqualTo("14.10");
    }

    @Test
    void delete_shouldSoftDelete() {
        TechStackEntity entity = buildEntity(techStackId, "POSTGRES_15");
        when(repository.findByIdAndDeletedAtIsNull(techStackId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<TechStackEntity> captor = ArgumentCaptor.forClass(TechStackEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(techStackId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    @Test
    void get_shouldThrow_whenTenantMismatch() {
        TechStackEntity entity = buildEntity(techStackId, "POSTGRES_15");
        entity.setTenantId("tenant-other");
        when(repository.findByIdAndDeletedAtIsNull(techStackId)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> service.get(techStackId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("技术栈不存在");
    }

    private TechStackEntity buildEntity(UUID id, String code) {
        return TechStackEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("PostgreSQL")
                .code(code)
                .category("DATABASE")
                .vendor("PGDG")
                .version("15.4")
                .lifecycleStatus("ACTIVE")
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}