package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.OntologyVersionCompareResponse;
import com.metaplatform.ont.dto.OntologyVersionCreateRequest;
import com.metaplatform.ont.dto.OntologyVersionResponse;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.entity.OntologyVersionEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OntologyVersionServiceTest {

    @Mock
    private OntologyVersionRepository versionRepository;

    @Mock
    private ConceptRepository conceptRepository;

    @Mock
    private AttributeRepository attributeRepository;

    @Mock
    private ConceptAttributeRepository conceptAttributeRepository;

    @Mock
    private RelationTypeRepository relationTypeRepository;

    @Mock
    private RelationInstanceRepository relationInstanceRepository;

    @Mock
    private EntityRepository entityRepository;

    @Mock
    private EntityAttributeValueRepository entityAttributeValueRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private OntologyVersionService versionService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void createSnapshot_shouldReturnVersionWithNumber1_whenNoExistingVersions() {
        when(versionRepository.findTopByTenantIdOrderByVersionNumberDesc(TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.empty());
        when(conceptRepository.findByTenantId(TenantContext.DEFAULT_TENANT_ID)).thenReturn(Collections.emptyList());
        when(attributeRepository.findByTenantId(TenantContext.DEFAULT_TENANT_ID)).thenReturn(Collections.emptyList());
        when(conceptAttributeRepository.findByTenantId(TenantContext.DEFAULT_TENANT_ID)).thenReturn(Collections.emptyList());
        when(relationTypeRepository.findByTenantId(TenantContext.DEFAULT_TENANT_ID)).thenReturn(Collections.emptyList());
        when(relationInstanceRepository.findByTenantId(TenantContext.DEFAULT_TENANT_ID)).thenReturn(Collections.emptyList());
        when(entityRepository.findByTenantId(TenantContext.DEFAULT_TENANT_ID)).thenReturn(Collections.emptyList());
        when(versionRepository.save(any(OntologyVersionEntity.class))).thenAnswer(inv -> {
            OntologyVersionEntity v = inv.getArgument(0);
            v.setVersionId(UUID.randomUUID().toString());
            return v;
        });

        OntologyVersionCreateRequest request = new OntologyVersionCreateRequest();
        request.setName("baseline");
        request.setDescription("init");

        OntologyVersionResponse response = versionService.createSnapshot(request);

        assertThat(response.getVersionNumber()).isEqualTo(1);
        assertThat(response.getName()).isEqualTo("baseline");
        assertThat(response.getStatus()).isEqualTo("DRAFT");
        assertThat(response.getSnapshot()).isNotNull();
    }

    @Test
    void list_shouldReturnPagedVersions() {
        OntologyVersionEntity v1 = version(2);
        OntologyVersionEntity v2 = version(1);
        when(versionRepository.findByTenantIdOrderByVersionNumberDesc(TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(List.of(v1, v2));

        PageResponse<OntologyVersionResponse> page = versionService.list(1, 10);

        assertThat(page.getTotal()).isEqualTo(2);
        assertThat(page.getItems().get(0).getVersionNumber()).isEqualTo(2);
    }

    @Test
    void getById_shouldReturnVersion_whenExists() {
        OntologyVersionEntity version = version(1);
        when(versionRepository.findByIdAndTenantId(version.getVersionId(), TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(version));

        OntologyVersionResponse response = versionService.getById(version.getVersionId());

        assertThat(response.getVersionNumber()).isEqualTo(1);
    }

    @Test
    void getById_shouldThrow_whenNotFound() {
        when(versionRepository.findByIdAndTenantId("missing", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> versionService.getById("missing"))
                .isInstanceOf(OntException.class)
                .extracting(ex -> ((OntException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_NOT_FOUND);
    }

    @Test
    void publish_shouldSetStatusPublished_andCurrentTrue() {
        OntologyVersionEntity version = version(1);
        version.setStatus("DRAFT");
        version.setCurrent(false);

        when(versionRepository.findByIdAndTenantId(version.getVersionId(), TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(version));
        when(versionRepository.findByTenantIdAndCurrentTrue(TenantContext.DEFAULT_TENANT_ID)).thenReturn(Optional.empty());
        when(versionRepository.save(any(OntologyVersionEntity.class))).thenReturn(version);

        OntologyVersionResponse response = versionService.publish(version.getVersionId());

        assertThat(response.getStatus()).isEqualTo("PUBLISHED");
        assertThat(response.getCurrent()).isTrue();
        assertThat(response.getPublishedAt()).isNotNull();
    }

    @Test
    void publish_shouldThrow_whenNotDraft() {
        OntologyVersionEntity version = version(1);
        version.setStatus("PUBLISHED");

        when(versionRepository.findByIdAndTenantId(version.getVersionId(), TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(version));

        assertThatThrownBy(() -> versionService.publish(version.getVersionId()))
                .isInstanceOf(OntException.class)
                .extracting(ex -> ((OntException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_CONFLICT);
    }

    @Test
    void compare_shouldReturnChangesAgainstCurrent() {
        OntologyVersionEntity source = version(1);
        OntologyVersionEntity current = version(2);

        when(versionRepository.findByIdAndTenantId(source.getVersionId(), TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(source));
        when(versionRepository.findByTenantIdAndCurrentTrue(TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(current));

        OntologyVersionCompareResponse response = versionService.compare(source.getVersionId(), null);

        assertThat(response.getSourceVersionId()).isEqualTo(source.getVersionId());
        assertThat(response.getTargetVersionId()).isEqualTo(current.getVersionId());
        assertThat(response.getChanges()).isNotEmpty();
    }

    @Test
    void rollback_shouldRequirePublishedStatus() {
        OntologyVersionEntity version = version(1);
        version.setStatus("DRAFT");

        when(versionRepository.findByIdAndTenantId(version.getVersionId(), TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(version));

        assertThatThrownBy(() -> versionService.rollback(version.getVersionId()))
                .isInstanceOf(OntException.class)
                .extracting(ex -> ((OntException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_NOT_PUBLISHED);
    }

    private OntologyVersionEntity version(int number) {
        ObjectNode snapshot = objectMapper.createObjectNode();
        snapshot.put("version", number);
        return OntologyVersionEntity.builder()
                .versionId(UUID.randomUUID().toString())
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .versionNumber(number)
                .name("v" + number)
                .snapshot(snapshot)
                .status("DRAFT")
                .current(false)
                .build();
    }
}
