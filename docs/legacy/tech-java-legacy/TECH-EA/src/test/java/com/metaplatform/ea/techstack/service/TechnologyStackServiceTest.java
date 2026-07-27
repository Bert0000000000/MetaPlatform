package com.metaplatform.ea.techstack.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techstack.dto.CreateTechnologyStackRequest;
import com.metaplatform.ea.techstack.dto.TechnologyStackComponentRef;
import com.metaplatform.ea.techstack.dto.TechnologyStackResponse;
import com.metaplatform.ea.techstack.dto.UpdateTechnologyStackRequest;
import com.metaplatform.ea.techstack.entity.TechnologyStackEntity;
import com.metaplatform.ea.techstack.repository.TechnologyStackRepository;
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
class TechnologyStackServiceTest {

    @Mock
    private TechnologyStackRepository repository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private TechnologyStackService service;

    private UUID stackId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        stackId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldSerializeComponents() {
        CreateTechnologyStackRequest request = new CreateTechnologyStackRequest();
        request.setName("订单服务");
        request.setApplicationId("app-order");
        TechnologyStackComponentRef ref = new TechnologyStackComponentRef();
        ref.setComponentId(UUID.randomUUID().toString());
        ref.setComponentName("Spring Boot");
        ref.setVersion("3.4");
        ref.setType("framework");
        request.setComponents(List.of(ref));

        when(repository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "订单服务"))
                .thenReturn(false);
        ArgumentCaptor<TechnologyStackEntity> captor = ArgumentCaptor.forClass(TechnologyStackEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        TechnologyStackResponse response = service.create(request);

        assertThat(captor.getValue().getComponentRefs()).contains("Spring Boot");
        assertThat(response.getComponents()).hasSize(1);
        assertThat(response.getComponents().get(0).getComponentName()).isEqualTo("Spring Boot");
    }

    @Test
    void create_shouldThrow_whenDuplicateName() {
        CreateTechnologyStackRequest request = new CreateTechnologyStackRequest();
        request.setName("订单服务");

        when(repository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "订单服务"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("已存在同名技术栈画像");
    }

    @Test
    void list_shouldReturnTenantScopedStacks() {
        TechnologyStackEntity entity = buildEntity(stackId, "订单服务");
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<TechnologyStackResponse> result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("订单服务");
        assertThat(result.get(0).getComponents()).isEmpty();
    }

    @Test
    void update_shouldReplaceComponents() {
        TechnologyStackEntity entity = buildEntity(stackId, "订单服务");
        when(repository.findByIdAndDeletedAtIsNull(stackId)).thenReturn(Optional.of(entity));
        when(repository.save(any(TechnologyStackEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateTechnologyStackRequest request = new UpdateTechnologyStackRequest();
        TechnologyStackComponentRef ref = new TechnologyStackComponentRef();
        ref.setComponentId(UUID.randomUUID().toString());
        ref.setComponentName("Redis");
        request.setComponents(List.of(ref));

        TechnologyStackResponse response = service.update(stackId, request);

        assertThat(response.getComponents()).hasSize(1);
        assertThat(response.getComponents().get(0).getComponentName()).isEqualTo("Redis");
    }

    @Test
    void delete_shouldSoftDelete() {
        TechnologyStackEntity entity = buildEntity(stackId, "订单服务");
        when(repository.findByIdAndDeletedAtIsNull(stackId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<TechnologyStackEntity> captor = ArgumentCaptor.forClass(TechnologyStackEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(stackId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private TechnologyStackEntity buildEntity(UUID id, String name) {
        return TechnologyStackEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .applicationId("app-order")
                .name(name)
                .description("订单服务技术栈")
                .componentRefs("[]")
                .status("active")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
