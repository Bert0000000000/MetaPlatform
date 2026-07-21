package com.metaplatform.ea.dataarchitecture.service;

import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataStandardRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataStandardResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataStandardRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataStandardEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataStandardRepository;
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
class DataStandardServiceTest {

    @Mock
    private DataStandardRepository repository;

    @InjectMocks
    private DataStandardService service;

    private UUID standardId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        standardId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersistStandard() {
        CreateDataStandardRequest request = new CreateDataStandardRequest();
        request.setCode("PHONE_FORMAT");
        request.setName("手机号格式");
        request.setStandardType("format");
        request.setRule("^1[3-9]\\d{9}$");
        request.setDescription("中国大陆手机号");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "PHONE_FORMAT"))
                .thenReturn(false);
        ArgumentCaptor<DataStandardEntity> captor = ArgumentCaptor.forClass(DataStandardEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        DataStandardResponse response = service.create(request);

        assertThat(captor.getValue().getCode()).isEqualTo("PHONE_FORMAT");
        assertThat(captor.getValue().getStandardType()).isEqualTo("format");
        assertThat(response.getRule()).isEqualTo("^1[3-9]\\d{9}$");
    }

    @Test
    void create_shouldThrow_whenDuplicateCode() {
        CreateDataStandardRequest request = new CreateDataStandardRequest();
        request.setCode("PHONE_FORMAT");
        request.setName("手机号格式");
        request.setStandardType("format");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "PHONE_FORMAT"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("数据标准编码已存在");
    }

    @Test
    void list_shouldReturnStandards() {
        DataStandardEntity entity = buildEntity(standardId, "PHONE_FORMAT");
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<DataStandardResponse> result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCode()).isEqualTo("PHONE_FORMAT");
    }

    @Test
    void update_shouldChangeRule() {
        DataStandardEntity entity = buildEntity(standardId, "PHONE_FORMAT");
        when(repository.findByIdAndDeletedAtIsNull(standardId)).thenReturn(Optional.of(entity));
        when(repository.save(any(DataStandardEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateDataStandardRequest request = new UpdateDataStandardRequest();
        request.setRule("^1[3-9]\\d{10}$");
        request.setDescription("更新后的描述");

        DataStandardResponse response = service.update(standardId, request);

        assertThat(response.getRule()).isEqualTo("^1[3-9]\\d{10}$");
        assertThat(response.getDescription()).isEqualTo("更新后的描述");
    }

    @Test
    void update_shouldThrow_whenDuplicateCode() {
        DataStandardEntity entity = buildEntity(standardId, "PHONE_FORMAT");
        when(repository.findByIdAndDeletedAtIsNull(standardId)).thenReturn(Optional.of(entity));
        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "EMAIL_FORMAT"))
                .thenReturn(true);

        UpdateDataStandardRequest request = new UpdateDataStandardRequest();
        request.setCode("EMAIL_FORMAT");

        assertThatThrownBy(() -> service.update(standardId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("数据标准编码已存在");
    }

    @Test
    void delete_shouldSoftDelete() {
        DataStandardEntity entity = buildEntity(standardId, "PHONE_FORMAT");
        when(repository.findByIdAndDeletedAtIsNull(standardId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<DataStandardEntity> captor = ArgumentCaptor.forClass(DataStandardEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(standardId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private DataStandardEntity buildEntity(UUID id, String code) {
        return DataStandardEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .code(code)
                .name("手机号格式")
                .standardType("format")
                .rule("^1[3-9]\\d{9}$")
                .description("desc")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
