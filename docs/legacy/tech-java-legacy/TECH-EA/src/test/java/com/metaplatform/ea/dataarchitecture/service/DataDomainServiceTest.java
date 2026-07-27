package com.metaplatform.ea.dataarchitecture.service;

import com.metaplatform.ea.common.PageResponse;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataDomainRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataDomainResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataDomainRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataDomainEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataDomainRepository;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DataDomainServiceTest {

    @Mock
    private DataDomainRepository repository;

    @InjectMocks
    private DataDomainService service;

    private UUID domainId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        domainId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersist_whenCodeIsAvailable() {
        CreateDataDomainRequest request = new CreateDataDomainRequest();
        request.setName("客户域");
        request.setCode("CUSTOMER");
        request.setDescription("客户主数据");
        request.setOwner("data-team");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "CUSTOMER"))
                .thenReturn(false);
        ArgumentCaptor<DataDomainEntity> captor = ArgumentCaptor.forClass(DataDomainEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        DataDomainResponse response = service.create(request);

        assertThat(captor.getValue().getTenantId()).isEqualTo("tenant-default");
        assertThat(captor.getValue().getCode()).isEqualTo("CUSTOMER");
        assertThat(response.getOwner()).isEqualTo("data-team");
        assertThat(response.getMetadata()).isEqualTo("{}");
    }

    @Test
    void create_shouldThrow_whenCodeExists() {
        CreateDataDomainRequest request = new CreateDataDomainRequest();
        request.setName("客户域");
        request.setCode("CUSTOMER");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "CUSTOMER"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("数据域编码已存在");
    }

    @Test
    void list_shouldReturnTenantScopedDomains() {
        DataDomainEntity entity = buildEntity(domainId, "CUSTOMER", "客户域");
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(entity));

        List<DataDomainResponse> result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCode()).isEqualTo("CUSTOMER");
    }

    @Test
    void get_shouldThrow_whenTenantMismatch() {
        DataDomainEntity entity = buildEntity(domainId, "CUSTOMER", "客户域");
        entity.setTenantId("tenant-other");
        when(repository.findByIdAndDeletedAtIsNull(domainId)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> service.get(domainId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("数据域不存在");
    }

    @Test
    void update_shouldModifyMutableFields() {
        DataDomainEntity entity = buildEntity(domainId, "CUSTOMER", "客户域");
        when(repository.findByIdAndDeletedAtIsNull(domainId)).thenReturn(Optional.of(entity));
        when(repository.save(any(DataDomainEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateDataDomainRequest request = new UpdateDataDomainRequest();
        request.setName("客户主数据");
        request.setOwner("governance-team");

        DataDomainResponse response = service.update(domainId, request);

        assertThat(response.getName()).isEqualTo("客户主数据");
        assertThat(response.getOwner()).isEqualTo("governance-team");
    }

    @Test
    void delete_shouldSoftDelete() {
        DataDomainEntity entity = buildEntity(domainId, "CUSTOMER", "客户域");
        when(repository.findByIdAndDeletedAtIsNull(domainId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<DataDomainEntity> captor = ArgumentCaptor.forClass(DataDomainEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(domainId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private DataDomainEntity buildEntity(UUID id, String code, String name) {
        return DataDomainEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name(name)
                .code(code)
                .description("desc")
                .owner("owner")
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}