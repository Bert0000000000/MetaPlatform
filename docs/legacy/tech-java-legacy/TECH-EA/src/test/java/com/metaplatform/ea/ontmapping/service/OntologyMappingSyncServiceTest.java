package com.metaplatform.ea.ontmapping.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.application.service.ApplicationService;
import com.metaplatform.ea.capability.dto.CapabilityResponse;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.governance.review.dto.ReviewTicketResponse;
import com.metaplatform.ea.governance.review.service.ReviewTicketService;
import com.metaplatform.ea.mapping.service.OntIntegrationService;
import com.metaplatform.ea.ontmapping.dto.OntologyChangeWebhookRequest;
import com.metaplatform.ea.ontmapping.dto.OntologyConceptSnapshot;
import com.metaplatform.ea.ontmapping.dto.SyncResultResponse;
import com.metaplatform.ea.ontmapping.entity.ConceptMappingRuleEntity;
import com.metaplatform.ea.ontmapping.entity.OntologyChangeEventEntity;
import com.metaplatform.ea.ontmapping.repository.ConceptMappingRuleRepository;
import com.metaplatform.ea.ontmapping.repository.OntologyChangeEventRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OntologyMappingSyncServiceTest {

    @Mock
    private ConceptMappingRuleRepository ruleRepository;

    @Mock
    private OntologyChangeEventRepository changeEventRepository;

    @Mock
    private OntIntegrationService ontIntegrationService;

    @Mock
    private BusinessCapabilityService capabilityService;

    @Mock
    private ApplicationService applicationService;

    @Mock
    private ReviewTicketService reviewTicketService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private OntologyMappingSyncService syncService;

    private UUID ruleId;
    private UUID assetId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        ruleId = UUID.randomUUID();
        assetId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void syncToOntology_shouldUpdateConcept_whenCapabilityAssetExists() {
        ConceptMappingRuleEntity rule = buildRule("CAPABILITY", assetId, "concept-001", "DIRECT");
        when(ruleRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(rule));
        when(capabilityService.get(assetId)).thenReturn(
                CapabilityResponse.builder().id(assetId).name("客户管理").description("管理客户").build());
        when(ontIntegrationService.updateConcept("concept-001", "客户管理", "管理客户")).thenReturn(true);
        when(ruleRepository.save(any(ConceptMappingRuleEntity.class))).thenAnswer(i -> i.getArgument(0));

        SyncResultResponse result = syncService.syncToOntology(null);

        assertThat(result.getUpdatedCount()).isEqualTo(1);
        assertThat(result.getSkippedCount()).isZero();
        assertThat(result.getFailedCount()).isZero();
        assertThat(rule.getAssetName()).isEqualTo("客户管理");
    }

    @Test
    void syncToOntology_shouldSkip_whenAssetNotFound() {
        ConceptMappingRuleEntity rule = buildRule("CAPABILITY", assetId, "concept-001", "DIRECT");
        when(ruleRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(rule));
        when(capabilityService.get(assetId)).thenThrow(new RuntimeException("not found"));

        SyncResultResponse result = syncService.syncToOntology(null);

        assertThat(result.getUpdatedCount()).isZero();
        assertThat(result.getSkippedCount()).isEqualTo(1);
        assertThat(result.getFailedCount()).isZero();
    }

    @Test
    void syncFromOntology_shouldUpdateAsset_whenConceptExists() {
        ConceptMappingRuleEntity rule = buildRule("CAPABILITY", assetId, "concept-001", "DIRECT");
        when(ruleRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(rule));
        when(ontIntegrationService.getConcept("concept-001")).thenReturn(
                OntologyConceptSnapshot.builder()
                        .conceptId("concept-001")
                        .conceptCode("CUSTOMER")
                        .name("客户")
                        .description("客户概念")
                        .build());
        when(ruleRepository.save(any(ConceptMappingRuleEntity.class))).thenAnswer(i -> i.getArgument(0));

        SyncResultResponse result = syncService.syncFromOntology(null);

        assertThat(result.getUpdatedCount()).isEqualTo(1);
        assertThat(result.getSyncedConceptIds()).containsExactly("concept-001");
        verify(capabilityService).update(eq(assetId), any());
    }

    @Test
    void syncFromOntology_shouldFail_whenConceptNotFound() {
        ConceptMappingRuleEntity rule = buildRule("APPLICATION", assetId, "concept-missing", "DIRECT");
        when(ruleRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(rule));
        when(ontIntegrationService.getConcept("concept-missing")).thenReturn(null);

        SyncResultResponse result = syncService.syncFromOntology(null);

        assertThat(result.getUpdatedCount()).isZero();
        assertThat(result.getFailedCount()).isEqualTo(1);
        assertThat(result.getFailedAssetIds()).containsExactly("concept-missing");
    }

    @Test
    void handleOntologyChangeWebhook_shouldCreateEventAndReviewTicket() {
        ConceptMappingRuleEntity rule = buildRule("APPLICATION", assetId, "concept-001", "DIRECT");
        when(ruleRepository.findByTenantIdAndConceptIdAndDeletedAtIsNull("tenant-default", "concept-001"))
                .thenReturn(List.of(rule));
        when(changeEventRepository.save(any(OntologyChangeEventEntity.class)))
                .thenAnswer(i -> i.getArgument(0));
        UUID ticketId = UUID.randomUUID();
        when(reviewTicketService.create(any())).thenReturn(
                ReviewTicketResponse.builder().id(ticketId).title("评审工单").build());

        OntologyChangeWebhookRequest request = new OntologyChangeWebhookRequest();
        request.setConceptId("concept-001");
        request.setConceptCode("CUSTOMER");
        request.setConceptName("客户");
        request.setChangeType("UPDATED");
        request.setPayload(Map.of("name", "客户"));

        syncService.handleOntologyChangeWebhook(request);

        verify(changeEventRepository, times(2)).save(any(OntologyChangeEventEntity.class));
        verify(reviewTicketService).create(any());
    }

    @Test
    void handleOntologyChangeWebhook_shouldSkip_whenNoMappingRule() {
        when(ruleRepository.findByTenantIdAndConceptIdAndDeletedAtIsNull("tenant-default", "concept-001"))
                .thenReturn(List.of());

        OntologyChangeWebhookRequest request = new OntologyChangeWebhookRequest();
        request.setConceptId("concept-001");
        request.setChangeType("UPDATED");

        syncService.handleOntologyChangeWebhook(request);

        verifyNoInteractions(changeEventRepository);
        verifyNoInteractions(reviewTicketService);
    }

    @Test
    void listPendingChanges_shouldReturnPendingEvents() {
        OntologyChangeEventEntity event = OntologyChangeEventEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .conceptId("concept-001")
                .changeType("UPDATED")
                .status("PENDING")
                .createdAt(Instant.now())
                .build();
        when(changeEventRepository.findByTenantIdAndStatusOrderByCreatedAtDesc("tenant-default", "PENDING"))
                .thenReturn(List.of(event));

        var result = syncService.listPendingChanges(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStatus()).isEqualTo("PENDING");
    }

    @Test
    void resolveChange_shouldMarkProcessed() {
        UUID eventId = UUID.randomUUID();
        OntologyChangeEventEntity event = OntologyChangeEventEntity.builder()
                .id(eventId)
                .tenantId("tenant-default")
                .status("PENDING")
                .build();
        when(changeEventRepository.findByIdAndTenantId(eventId, "tenant-default"))
                .thenReturn(Optional.of(event));
        when(changeEventRepository.save(any(OntologyChangeEventEntity.class))).thenAnswer(i -> i.getArgument(0));

        var result = syncService.resolveChange(eventId);

        assertThat(result.getStatus()).isEqualTo("PROCESSED");
    }

    private ConceptMappingRuleEntity buildRule(String assetType, UUID assetId, String conceptId, String mappingType) {
        return ConceptMappingRuleEntity.builder()
                .id(ruleId)
                .tenantId("tenant-default")
                .assetType(assetType)
                .assetId(assetId)
                .assetName("旧名称")
                .conceptId(conceptId)
                .conceptCode("CODE")
                .mappingType(mappingType)
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
