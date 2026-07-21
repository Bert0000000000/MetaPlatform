package com.metaplatform.ea.techcomponent.service;

import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techcomponent.dto.CreateTechnologyComponentRequest;
import com.metaplatform.ea.techcomponent.dto.TechnologyComponentResponse;
import com.metaplatform.ea.techcomponent.dto.UpdateTechnologyComponentRequest;
import com.metaplatform.ea.techcomponent.entity.TechnologyComponentEntity;
import com.metaplatform.ea.techcomponent.repository.TechnologyComponentRepository;
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
class TechnologyComponentServiceTest {

    @Mock
    private TechnologyComponentRepository repository;

    @InjectMocks
    private TechnologyComponentService service;

    private UUID componentId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        componentId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldDefaultStatus_whenNotProvided() {
        CreateTechnologyComponentRequest request = new CreateTechnologyComponentRequest();
        request.setName("PostgreSQL");
        request.setType("database");
        request.setVersion("17.0");

        when(repository.existsByTenantIdAndNameAndTypeAndDeletedAtIsNull("tenant-default", "PostgreSQL", "database"))
                .thenReturn(false);
        ArgumentCaptor<TechnologyComponentEntity> captor = ArgumentCaptor.forClass(TechnologyComponentEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        TechnologyComponentResponse response = service.create(request);

        assertThat(captor.getValue().getStatus()).isEqualTo("active");
        assertThat(response.getName()).isEqualTo("PostgreSQL");
        assertThat(response.getType()).isEqualTo("database");
    }

    @Test
    void create_shouldThrow_whenDuplicateNameType() {
        CreateTechnologyComponentRequest request = new CreateTechnologyComponentRequest();
        request.setName("PostgreSQL");
        request.setType("database");

        when(repository.existsByTenantIdAndNameAndTypeAndDeletedAtIsNull("tenant-default", "PostgreSQL", "database"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("已存在同名同类型的技术组件");
    }

    @Test
    void list_shouldReturnTenantScopedComponents() {
        TechnologyComponentEntity entity = buildEntity(componentId, "PostgreSQL", "database");
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<TechnologyComponentResponse> result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("PostgreSQL");
    }

    @Test
    void update_shouldChangeStatus() {
        TechnologyComponentEntity entity = buildEntity(componentId, "PostgreSQL", "database");
        when(repository.findByIdAndDeletedAtIsNull(componentId)).thenReturn(Optional.of(entity));
        when(repository.save(any(TechnologyComponentEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateTechnologyComponentRequest request = new UpdateTechnologyComponentRequest();
        request.setStatus("deprecated");
        request.setVersion("16.4");

        TechnologyComponentResponse response = service.update(componentId, request);

        assertThat(response.getStatus()).isEqualTo("deprecated");
        assertThat(response.getVersion()).isEqualTo("16.4");
    }

    @Test
    void delete_shouldSoftDelete() {
        TechnologyComponentEntity entity = buildEntity(componentId, "PostgreSQL", "database");
        when(repository.findByIdAndDeletedAtIsNull(componentId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<TechnologyComponentEntity> captor = ArgumentCaptor.forClass(TechnologyComponentEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(componentId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    @Test
    void get_shouldThrow_whenTenantMismatch() {
        TechnologyComponentEntity entity = buildEntity(componentId, "PostgreSQL", "database");
        entity.setTenantId("tenant-other");
        when(repository.findByIdAndDeletedAtIsNull(componentId)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> service.get(componentId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("技术组件不存在");
    }

    private TechnologyComponentEntity buildEntity(UUID id, String name, String type) {
        return TechnologyComponentEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name(name)
                .type(type)
                .version("17.0")
                .description("关系型数据库")
                .owner("平台组")
                .status("active")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
