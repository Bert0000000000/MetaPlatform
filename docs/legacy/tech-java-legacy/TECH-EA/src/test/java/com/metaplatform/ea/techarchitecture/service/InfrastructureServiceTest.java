package com.metaplatform.ea.techarchitecture.service;

import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techarchitecture.dto.CreateInfrastructureRequest;
import com.metaplatform.ea.techarchitecture.dto.InfrastructureResponse;
import com.metaplatform.ea.techarchitecture.dto.UpdateInfrastructureRequest;
import com.metaplatform.ea.techarchitecture.entity.InfrastructureEntity;
import com.metaplatform.ea.techarchitecture.repository.InfrastructureRepository;
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
class InfrastructureServiceTest {

    @Mock
    private InfrastructureRepository repository;

    @InjectMocks
    private InfrastructureService service;

    private UUID infrastructureId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        infrastructureId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersist() {
        CreateInfrastructureRequest request = new CreateInfrastructureRequest();
        request.setName("K8s Production");
        request.setCode("K8S_PROD");
        request.setEnvironment("PROD");
        request.setRegion("us-west-2");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "K8S_PROD"))
                .thenReturn(false);
        ArgumentCaptor<InfrastructureEntity> captor = ArgumentCaptor.forClass(InfrastructureEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        InfrastructureResponse response = service.create(request);

        assertThat(captor.getValue().getTenantId()).isEqualTo("tenant-default");
        assertThat(captor.getValue().getEnvironment()).isEqualTo("PROD");
        assertThat(response.getRegion()).isEqualTo("us-west-2");
    }

    @Test
    void create_shouldThrow_whenDuplicateCode() {
        CreateInfrastructureRequest request = new CreateInfrastructureRequest();
        request.setName("K8s Production");
        request.setCode("K8S_PROD");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "K8S_PROD"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("基础设施编码已存在");
    }

    @Test
    void list_shouldReturnTenantScoped() {
        InfrastructureEntity entity = buildEntity(infrastructureId, "K8S_PROD");
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<InfrastructureResponse> result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getEnvironment()).isEqualTo("PROD");
    }

    @Test
    void update_shouldChangeEnvironment() {
        InfrastructureEntity entity = buildEntity(infrastructureId, "K8S_PROD");
        when(repository.findByIdAndDeletedAtIsNull(infrastructureId)).thenReturn(Optional.of(entity));
        when(repository.save(any(InfrastructureEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateInfrastructureRequest request = new UpdateInfrastructureRequest();
        request.setEnvironment("STAGING");
        request.setRegion("eu-central-1");

        InfrastructureResponse response = service.update(infrastructureId, request);

        assertThat(response.getEnvironment()).isEqualTo("STAGING");
        assertThat(response.getRegion()).isEqualTo("eu-central-1");
    }

    @Test
    void delete_shouldSoftDelete() {
        InfrastructureEntity entity = buildEntity(infrastructureId, "K8S_PROD");
        when(repository.findByIdAndDeletedAtIsNull(infrastructureId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<InfrastructureEntity> captor = ArgumentCaptor.forClass(InfrastructureEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(infrastructureId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private InfrastructureEntity buildEntity(UUID id, String code) {
        return InfrastructureEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("K8s Production")
                .code(code)
                .environment("PROD")
                .region("us-west-2")
                .description("prod k8s")
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}