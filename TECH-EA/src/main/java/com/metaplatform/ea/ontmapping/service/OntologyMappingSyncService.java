package com.metaplatform.ea.ontmapping.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.application.dto.ApplicationResponse;
import com.metaplatform.ea.application.service.ApplicationService;
import com.metaplatform.ea.capability.dto.CapabilityResponse;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.governance.review.dto.CreateReviewTicketRequest;
import com.metaplatform.ea.governance.review.service.ReviewTicketService;
import com.metaplatform.ea.mapping.service.OntIntegrationService;
import com.metaplatform.ea.ontmapping.dto.*;
import com.metaplatform.ea.ontmapping.entity.ConceptMappingRuleEntity;
import com.metaplatform.ea.ontmapping.entity.OntologyChangeEventEntity;
import com.metaplatform.ea.ontmapping.repository.ConceptMappingRuleRepository;
import com.metaplatform.ea.ontmapping.repository.OntologyChangeEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OntologyMappingSyncService {

    private static final String ASSET_CAPABILITY = "CAPABILITY";
    private static final String ASSET_APPLICATION = "APPLICATION";
    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_PROCESSED = "PROCESSED";

    private final ConceptMappingRuleRepository ruleRepository;
    private final OntologyChangeEventRepository changeEventRepository;
    private final OntIntegrationService ontIntegrationService;
    private final BusinessCapabilityService capabilityService;
    private final ApplicationService applicationService;
    private final ReviewTicketService reviewTicketService;
    private final ObjectMapper objectMapper;

    @Transactional
    public SyncResultResponse syncToOntology(String assetType) {
        String tenantId = TenantContext.getOrDefault();
        List<ConceptMappingRuleEntity> rules = fetchRules(tenantId, assetType);

        int updated = 0, skipped = 0, failed = 0;
        List<String> synced = new ArrayList<>();
        List<String> failedIds = new ArrayList<>();

        for (ConceptMappingRuleEntity rule : rules) {
            AssetInfo asset = resolveAsset(rule.getAssetType(), rule.getAssetId());
            if (asset == null) {
                skipped++;
                continue;
            }
            boolean ok = ontIntegrationService.updateConcept(rule.getConceptId(), asset.name(), asset.description());
            if (ok) {
                updated++;
                synced.add(rule.getConceptId());
                if (!asset.name().equals(rule.getAssetName())) {
                    rule.setAssetName(asset.name());
                    rule.setUpdatedAt(Instant.now());
                    ruleRepository.save(rule);
                }
            } else {
                failed++;
                failedIds.add(rule.getAssetId().toString());
            }
        }

        return SyncResultResponse.builder()
                .createdCount(0)
                .updatedCount(updated)
                .skippedCount(skipped)
                .failedCount(failed)
                .syncedConceptIds(synced)
                .failedAssetIds(failedIds)
                .summary(String.format("同步到 Ontology 完成：更新 %d / 跳过 %d / 失败 %d", updated, skipped, failed))
                .build();
    }

    @Transactional
    public SyncResultResponse syncFromOntology(String assetType) {
        String tenantId = TenantContext.getOrDefault();
        List<ConceptMappingRuleEntity> rules = fetchRules(tenantId, assetType);

        int updated = 0, skipped = 0, failed = 0;
        List<String> synced = new ArrayList<>();
        List<String> failedIds = new ArrayList<>();

        for (ConceptMappingRuleEntity rule : rules) {
            OntologyConceptSnapshot concept = ontIntegrationService.getConcept(rule.getConceptId());
            if (concept == null) {
                failed++;
                failedIds.add(rule.getConceptId());
                continue;
            }
            boolean ok = applyConceptToAsset(rule, concept);
            if (ok) {
                updated++;
                synced.add(rule.getConceptId());
                if (concept.getName() != null && !concept.getName().equals(rule.getAssetName())) {
                    rule.setAssetName(concept.getName());
                }
                if (concept.getConceptCode() != null && !concept.getConceptCode().equals(rule.getConceptCode())) {
                    rule.setConceptCode(concept.getConceptCode());
                }
                rule.setUpdatedAt(Instant.now());
                ruleRepository.save(rule);
            } else {
                skipped++;
            }
        }

        return SyncResultResponse.builder()
                .createdCount(0)
                .updatedCount(updated)
                .skippedCount(skipped)
                .failedCount(failed)
                .syncedConceptIds(synced)
                .failedAssetIds(failedIds)
                .summary(String.format("从 Ontology 同步完成：更新 %d / 跳过 %d / 失败 %d", updated, skipped, failed))
                .build();
    }

    @Transactional
    public void handleOntologyChangeWebhook(OntologyChangeWebhookRequest request) {
        String tenantId = TenantContext.getOrDefault();
        List<ConceptMappingRuleEntity> rules = ruleRepository
                .findByTenantIdAndConceptIdAndDeletedAtIsNull(tenantId, request.getConceptId());

        if (rules.isEmpty()) {
            log.info("No mapping rule found for concept {}, skip review ticket creation", request.getConceptId());
            return;
        }

        Instant now = Instant.now();
        String payload = writeJson(Map.of(
                "conceptId", request.getConceptId(),
                "conceptCode", request.getConceptCode(),
                "conceptName", request.getConceptName(),
                "changeType", request.getChangeType(),
                "payload", request.getPayload() != null ? request.getPayload() : Map.of()
        ));

        for (ConceptMappingRuleEntity rule : rules) {
            OntologyChangeEventEntity event = OntologyChangeEventEntity.builder()
                    .tenantId(tenantId)
                    .conceptId(request.getConceptId())
                    .conceptCode(request.getConceptCode())
                    .conceptName(request.getConceptName())
                    .changeType(request.getChangeType())
                    .ruleId(rule.getId())
                    .assetType(rule.getAssetType())
                    .assetId(rule.getAssetId())
                    .status(STATUS_PENDING)
                    .payload(payload)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            OntologyChangeEventEntity savedEvent = changeEventRepository.save(event);

            CreateReviewTicketRequest ticketRequest = new CreateReviewTicketRequest();
            ticketRequest.setTitle(buildTicketTitle(rule, request));
            ticketRequest.setTargetType(rule.getAssetType());
            ticketRequest.setTargetId(rule.getAssetId());
            ticketRequest.setMetadata(payload);
            var ticket = reviewTicketService.create(ticketRequest);

            savedEvent.setReviewTicketId(ticket.getId());
            savedEvent.setUpdatedAt(Instant.now());
            changeEventRepository.save(savedEvent);
        }
    }

    @Transactional(readOnly = true)
    public List<OntologyChangeEventResponse> listPendingChanges(String conceptId) {
        String tenantId = TenantContext.getOrDefault();
        List<OntologyChangeEventEntity> events;
        if (StringUtils.hasText(conceptId)) {
            events = changeEventRepository.findByTenantIdAndConceptIdAndStatusOrderByCreatedAtDesc(
                    tenantId, conceptId, STATUS_PENDING);
        } else {
            events = changeEventRepository.findByTenantIdAndStatusOrderByCreatedAtDesc(tenantId, STATUS_PENDING);
        }
        return events.stream().map(this::toChangeResponse).toList();
    }

    @Transactional
    public OntologyChangeEventResponse resolveChange(UUID eventId) {
        OntologyChangeEventEntity event = findChangeEvent(eventId);
        event.setStatus(STATUS_PROCESSED);
        event.setUpdatedAt(Instant.now());
        return toChangeResponse(changeEventRepository.save(event));
    }

    private List<ConceptMappingRuleEntity> fetchRules(String tenantId, String assetType) {
        if (StringUtils.hasText(assetType)) {
            return ruleRepository.findByTenantIdAndAssetTypeAndDeletedAtIsNull(tenantId, assetType.toUpperCase());
        }
        return ruleRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
    }

    private AssetInfo resolveAsset(String assetType, UUID assetId) {
        try {
            if (ASSET_CAPABILITY.equals(assetType)) {
                CapabilityResponse cap = capabilityService.get(assetId);
                return new AssetInfo(cap.getName(), cap.getDescription());
            }
            if (ASSET_APPLICATION.equals(assetType)) {
                ApplicationResponse app = applicationService.get(assetId);
                return new AssetInfo(app.getName(), app.getDescription());
            }
        } catch (Exception e) {
            log.warn("Failed to resolve asset {}:{}", assetType, assetId, e);
        }
        return null;
    }

    private boolean applyConceptToAsset(ConceptMappingRuleEntity rule, OntologyConceptSnapshot concept) {
        try {
            if (ASSET_CAPABILITY.equals(rule.getAssetType())) {
                com.metaplatform.ea.capability.dto.UpdateCapabilityRequest req =
                        new com.metaplatform.ea.capability.dto.UpdateCapabilityRequest();
                if (StringUtils.hasText(concept.getName())) req.setName(concept.getName());
                if (concept.getDescription() != null) req.setDescription(concept.getDescription());
                capabilityService.update(rule.getAssetId(), req);
                return true;
            }
            if (ASSET_APPLICATION.equals(rule.getAssetType())) {
                com.metaplatform.ea.application.dto.UpdateApplicationRequest req =
                        new com.metaplatform.ea.application.dto.UpdateApplicationRequest();
                if (StringUtils.hasText(concept.getName())) req.setName(concept.getName());
                if (concept.getDescription() != null) req.setDescription(concept.getDescription());
                applicationService.update(rule.getAssetId(), req);
                return true;
            }
        } catch (Exception e) {
            log.warn("Failed to apply concept to asset {}:{}", rule.getAssetType(), rule.getAssetId(), e);
        }
        return false;
    }

    private String buildTicketTitle(ConceptMappingRuleEntity rule, OntologyChangeWebhookRequest request) {
        String assetName = rule.getAssetName() != null ? rule.getAssetName() : rule.getAssetId().toString();
        String conceptName = StringUtils.hasText(request.getConceptName()) ? request.getConceptName() : request.getConceptId();
        return String.format("Ontology 概念 [%s] 变更，影响架构资产 [%s/%s]", conceptName, rule.getAssetType(), assetName);
    }

    private OntologyChangeEventEntity findChangeEvent(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return changeEventRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new com.metaplatform.ea.exception.EaException(
                        com.metaplatform.ea.common.ErrorCode.NOT_FOUND, "变更事件不存在"));
    }

    private OntologyChangeEventResponse toChangeResponse(OntologyChangeEventEntity entity) {
        return OntologyChangeEventResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .conceptId(entity.getConceptId())
                .conceptCode(entity.getConceptCode())
                .conceptName(entity.getConceptName())
                .changeType(entity.getChangeType())
                .ruleId(entity.getRuleId())
                .assetType(entity.getAssetType())
                .assetId(entity.getAssetId())
                .status(entity.getStatus())
                .reviewTicketId(entity.getReviewTicketId())
                .payload(entity.getPayload())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize payload", e);
            return "{}";
        }
    }

    private record AssetInfo(String name, String description) {}
}
