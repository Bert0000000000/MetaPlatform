package com.metaplatform.ea.dataarchitecture.service;

import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataEntityRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataEntityResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataEntityRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataEntityEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataEntityRepository;
import com.metaplatform.ea.exception.EaException;
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
class DataEntityServiceTest {

    @Mock
    private DataEntityRepository repository;

    @InjectMocks
    private DataEntityService service;

    private UUID entityId;
    private UUID domainId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        entityId = UUID.randomUUID();
        domainId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersistEntity() {
        CreateDataEntityRequest request = new CreateDataEntityRequest();
        request.setDomainId(domainId);
        request.setName("客户");
        request.setCode("CUSTOMER_ENTITY");
        request.setEntityType("MASTER_DATA");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "CUSTOMER_ENTITY"))
                .thenReturn(false);
        ArgumentCaptor<DataEntityEntity> captor = ArgumentCaptor.forClass(DataEntityEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        DataEntityResponse response = service.create(request);

        assertThat(captor.getValue().getTenantId()).isEqualTo("tenant-default");
        assertThat(captor.getValue().getEntityType()).isEqualTo("MASTER_DATA");
        assertThat(response.getCode()).isEqualTo("CUSTOMER_ENTITY");
    }

    @Test
    void create_shouldThrow_whenDuplicateCode() {
        CreateDataEntityRequest request = new CreateDataEntityRequest();
        request.setName("客户");
        request.setCode("CUSTOMER_ENTITY");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "CUSTOMER_ENTITY"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("数据实体编码已存在");
    }

    @Test
    void list_shouldFilterByDomainWhenProvided() {
        DataEntityEntity entity = buildEntity(entityId, "CUSTOMER_ENTITY");
        when(repository.findByDomainIdAndDeletedAtIsNull(domainId)).thenReturn(List.of(entity));

        List<DataEntityResponse> result = service.list(domainId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getDomainId()).isEqualTo(domainId);
    }

    @Test
    void update_shouldChangeEntityType() {
        DataEntityEntity entity = buildEntity(entityId, "CUSTOMER_ENTITY");
        when(repository.findByIdAndDeletedAtIsNull(entityId)).thenReturn(Optional.of(entity));
        when(repository.save(any(DataEntityEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateDataEntityRequest request = new UpdateDataEntityRequest();
        request.setEntityType("TRANSACTIONAL");
        request.setDescription("updated");

        DataEntityResponse response = service.update(entityId, request);

        assertThat(response.getEntityType()).isEqualTo("TRANSACTIONAL");
        assertThat(response.getDescription()).isEqualTo("updated");
    }

    @Test
    void get_shouldThrow_whenTenantMismatch() {
        DataEntityEntity entity = buildEntity(entityId, "CUSTOMER_ENTITY");
        entity.setTenantId("tenant-other");
        when(repository.findByIdAndDeletedAtIsNull(entityId)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> service.get(entityId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("数据实体不存在");
    }

    private DataEntityEntity buildEntity(UUID id, String code) {
        return DataEntityEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .domainId(domainId)
                .name("客户")
                .code(code)
                .description("desc")
                .entityType("MASTER_DATA")
                .attributes("[]")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}