package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.OntologyVersionCompareResponse;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VersionCompareTest {

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
    void compareByTwoIds_bothExist_returnsDiff() {
        OntologyVersionEntity a = versionEntity(1, snapshotWithConcepts("c-1"));
        OntologyVersionEntity b = versionEntity(2, snapshotWithConcepts("c-1", "c-2"));

        when(versionRepository.findByVersionIdAndTenantId(a.getVersionId(), TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(a));
        when(versionRepository.findByVersionIdAndTenantId(b.getVersionId(), TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(b));

        OntologyVersionCompareResponse response = versionService.compareByTwoIds(a.getVersionId(), b.getVersionId());

        assertThat(response).isNotNull();
        assertThat(response.getSourceVersionId()).isEqualTo(a.getVersionId());
        assertThat(response.getTargetVersionId()).isEqualTo(b.getVersionId());
        assertThat(response.getChanges()).isNotEmpty();
        // Both snapshots share c-1; b additionally has c-2 -> added=1
        OntologyVersionCompareResponse.ChangeSummary concepts =
                response.getChanges().get("concepts");
        assertThat(concepts).isNotNull();
        assertThat(concepts.getAdded()).isEqualTo(1);
        assertThat(concepts.getRemoved()).isZero();
    }

    @Test
    void compareByTwoIds_bothIdentical_returnsEmptyDiff() {
        OntologyVersionEntity a = versionEntity(1, snapshotWithConcepts("c-1"));
        OntologyVersionEntity b = versionEntity(2, snapshotWithConcepts("c-1"));

        when(versionRepository.findByVersionIdAndTenantId(a.getVersionId(), TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(a));
        when(versionRepository.findByVersionIdAndTenantId(b.getVersionId(), TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(b));

        OntologyVersionCompareResponse response = versionService.compareByTwoIds(a.getVersionId(), b.getVersionId());

        assertThat(response).isNotNull();
        assertThat(response.getChanges()).isNotEmpty();
        OntologyVersionCompareResponse.ChangeSummary concepts =
                response.getChanges().get("concepts");
        assertThat(concepts.getAdded()).isZero();
        assertThat(concepts.getRemoved()).isZero();
        assertThat(concepts.getModified()).isZero();
    }

    @Test
    void compareByTwoIds_aNotFound_throwsException() {
        String missingId = UUID.randomUUID().toString();

        when(versionRepository.findByVersionIdAndTenantId(missingId, TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> versionService.compareByTwoIds(missingId, "any-other-id"))
                .isInstanceOf(OntException.class)
                .extracting(ex -> ((OntException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_NOT_FOUND);
    }

    private OntologyVersionEntity versionEntity(int number, ObjectNode snapshot) {
        return OntologyVersionEntity.builder()
                .versionId(UUID.randomUUID().toString())
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .versionNumber(number)
                .name("v" + number)
                .description("desc " + number)
                .snapshot(snapshot)
                .status("DRAFT")
                .current(false)
                .build();
    }

    private ObjectNode snapshotWithConcepts(String... conceptIds) {
        ObjectNode snapshot = objectMapper.createObjectNode();
        ArrayNode concepts = objectMapper.createArrayNode();
        for (String id : conceptIds) {
            ObjectNode concept = objectMapper.createObjectNode();
            concept.put("id", id);
            concept.put("code", id);
            concepts.add(concept);
        }
        snapshot.set("concepts", concepts);
        snapshot.set("attributes", objectMapper.createArrayNode());
        snapshot.set("relationTypes", objectMapper.createArrayNode());
        snapshot.set("relationInstances", objectMapper.createArrayNode());
        snapshot.set("entities", objectMapper.createArrayNode());
        return snapshot;
    }
}