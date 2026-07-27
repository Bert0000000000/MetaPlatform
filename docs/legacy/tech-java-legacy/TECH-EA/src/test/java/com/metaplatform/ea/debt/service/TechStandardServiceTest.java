package com.metaplatform.ea.debt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.debt.dto.CreateTechStandardRequest;
import com.metaplatform.ea.debt.dto.TechStandardResponse;
import com.metaplatform.ea.debt.dto.UpdateTechStandardRequest;
import com.metaplatform.ea.debt.entity.TechStandardEntity;
import com.metaplatform.ea.debt.repository.TechStandardRepository;
import com.metaplatform.ea.exception.EaException;
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
class TechStandardServiceTest {

    @Mock
    private TechStandardRepository repository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private TechStandardService service;

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
    void create_shouldDefaultMandatoryToTrue() {
        CreateTechStandardRequest request = new CreateTechStandardRequest();
        request.setName("Java 编码规范");
        request.setCode("JAVA-CODING-STD");
        request.setCategory("CODING");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "JAVA-CODING-STD"))
                .thenReturn(false);
        ArgumentCaptor<TechStandardEntity> captor = ArgumentCaptor.forClass(TechStandardEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        TechStandardResponse response = service.create(request);

        assertThat(captor.getValue().getMandatory()).isTrue();
        assertThat(response.getCode()).isEqualTo("JAVA-CODING-STD");
    }

    @Test
    void create_shouldThrow_whenDuplicateCode() {
        CreateTechStandardRequest request = new CreateTechStandardRequest();
        request.setName("x");
        request.setCode("STD-001");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "STD-001"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("技术标准编码已存在");
    }

    @Test
    void list_shouldReturnTenantScoped() {
        TechStandardEntity entity = buildEntity(standardId, "JAVA-CODING-STD");
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<TechStandardResponse> result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCode()).isEqualTo("JAVA-CODING-STD");
    }

    @Test
    void update_shouldChangeMandatory() {
        TechStandardEntity entity = buildEntity(standardId, "JAVA-CODING-STD");
        when(repository.findByIdAndDeletedAtIsNull(standardId)).thenReturn(Optional.of(entity));
        when(repository.save(any(TechStandardEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateTechStandardRequest request = new UpdateTechStandardRequest();
        request.setMandatory(false);
        request.setVersion("2.0");

        TechStandardResponse response = service.update(standardId, request);

        assertThat(response.getMandatory()).isFalse();
        assertThat(response.getVersion()).isEqualTo("2.0");
    }

    @Test
    void delete_shouldSoftDelete() {
        TechStandardEntity entity = buildEntity(standardId, "JAVA-CODING-STD");
        when(repository.findByIdAndDeletedAtIsNull(standardId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<TechStandardEntity> captor = ArgumentCaptor.forClass(TechStandardEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(standardId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    @Test
    void get_shouldThrow_whenTenantMismatch() {
        TechStandardEntity entity = buildEntity(standardId, "STD");
        entity.setTenantId("tenant-other");
        when(repository.findByIdAndDeletedAtIsNull(standardId)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> service.get(standardId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("技术标准不存在");
    }

    private TechStandardEntity buildEntity(UUID id, String code) {
        return TechStandardEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("Java 编码规范")
                .code(code)
                .category("CODING")
                .version("1.0")
                .description("Java 编码规范")
                .mandatory(true)
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}