package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.OntologyVersionResponse;
import com.metaplatform.ont.dto.OntologyVersionUpdateRequest;
import com.metaplatform.ont.entity.OntologyVersionEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.AttributeRepository;
import com.metaplatform.ont.repository.ConceptAttributeRepository;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.EntityAttributeValueRepository;
import com.metaplatform.ont.repository.EntityRepository;
import com.metaplatform.ont.repository.OntologyVersionRepository;
import com.metaplatform.ont.repository.RelationInstanceRepository;
import com.metaplatform.ont.repository.RelationTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OntologyVersionUpdateTest {

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
    void update_existingVersion_returnsUpdated() {
        OntologyVersionEntity existing = versionEntity(1, "old description");
        when(versionRepository.findByVersionIdAndTenantId(existing.getVersionId(),
                TenantContext.DEFAULT_TENANT_ID)).thenReturn(Optional.of(existing));
        when(versionRepository.save(any(OntologyVersionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        OntologyVersionUpdateRequest request = new OntologyVersionUpdateRequest();
        request.setDescription("new description");

        OntologyVersionResponse response = versionService.update(existing.getVersionId(), request);

        assertThat(response).isNotNull();
        assertThat(response.getVersionId()).isEqualTo(existing.getVersionId());
        assertThat(response.getVersionNumber()).isEqualTo(1);
        assertThat(response.getDescription()).isEqualTo("new description");

        verify(versionRepository).save(any(OntologyVersionEntity.class));
    }

    @Test
    void update_notFound_throwsException() {
        String missingId = UUID.randomUUID().toString();
        when(versionRepository.findByVersionIdAndTenantId(eq(missingId), eq(TenantContext.DEFAULT_TENANT_ID)))
                .thenReturn(Optional.empty());

        OntologyVersionUpdateRequest request = new OntologyVersionUpdateRequest();
        request.setDescription("ignored");

        assertThatThrownBy(() -> versionService.update(missingId, request))
                .isInstanceOf(OntException.class)
                .extracting(ex -> ((OntException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_NOT_FOUND);

        verify(versionRepository, never()).save(any(OntologyVersionEntity.class));
    }

    private OntologyVersionEntity versionEntity(int number, String description) {
        ObjectNode snapshot = objectMapper.createObjectNode();
        snapshot.put("version", number);
        return OntologyVersionEntity.builder()
                .versionId(UUID.randomUUID().toString())
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .versionNumber(number)
                .name("v" + number)
                .description(description)
                .snapshot(snapshot)
                .status("DRAFT")
                .current(false)
                .build();
    }
}