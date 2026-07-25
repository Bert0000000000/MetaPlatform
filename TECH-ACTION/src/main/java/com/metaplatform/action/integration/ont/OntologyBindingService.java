package com.metaplatform.action.integration.ont;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.definition.entity.ActionDefinitionEntity;
import com.metaplatform.action.definition.repository.ActionDefinitionRepository;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.integration.ont.dto.OntologyBindingRequest;
import com.metaplatform.action.integration.ont.dto.OntologyBindingResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OntologyBindingService {

    private static final TypeReference<List<OntologyBindingRequest.FieldMapping>> MAPPING_TYPE =
            new TypeReference<>() {};

    private final ActionDefinitionRepository actionDefinitionRepository;
    private final OntologyIntegrationService ontologyIntegrationService;
    private final ObjectMapper objectMapper;

    @Value("${action.integration.ont.binding.input-entity-required:true}")
    private boolean inputEntityRequired;

    @Value("${action.integration.ont.binding.output-entity-required:false}")
    private boolean outputEntityRequired;

    @Transactional
    public OntologyBindingResponse bind(String actionId, OntologyBindingRequest request) {
        ActionDefinitionEntity action = findAction(actionId);

        if (request.getFieldMappings() == null || request.getFieldMappings().isEmpty()) {
            throw new ActionException(ErrorCode.INVALID_PARAM, "fieldMappings 不能为空");
        }
        for (OntologyBindingRequest.FieldMapping mapping : request.getFieldMappings()) {
            if (mapping.getSource() == null || mapping.getTarget() == null) {
                throw new ActionException(ErrorCode.INVALID_PARAM, "fieldMapping source/target 不能为空");
            }
        }

        ontologyIntegrationService.validateEntity(request.getInputEntityId(), inputEntityRequired);
        ontologyIntegrationService.validateEntity(request.getOutputEntityId(), outputEntityRequired);

        Map<String, Object> binding = new LinkedHashMap<>();
        binding.put("inputEntityId", request.getInputEntityId());
        binding.put("outputEntityId", request.getOutputEntityId());
        binding.put("fieldMappings", request.getFieldMappings());

        action.setOntologyBinding(binding);
        action.setUpdatedBy("system");
        action.setUpdatedAt(Instant.now());
        actionDefinitionRepository.save(action);

        return toResponse(action, request.getInputEntityId(), request.getOutputEntityId(),
                request.getFieldMappings());
    }

    @Transactional(readOnly = true)
    public OntologyBindingResponse getBinding(String actionId) {
        ActionDefinitionEntity action = findAction(actionId);
        Map<String, Object> binding = action.getOntologyBinding();
        if (binding == null || binding.isEmpty()) {
            throw new ActionException(ErrorCode.NOT_FOUND, "Action 未绑定本体实体: " + actionId);
        }
        try {
            Object mappings = binding.get("fieldMappings");
            List<OntologyBindingRequest.FieldMapping> fieldMappings = mappings == null
                    ? List.of()
                    : objectMapper.convertValue(mappings, MAPPING_TYPE);
            return toResponse(action,
                    (String) binding.get("inputEntityId"),
                    (String) binding.get("outputEntityId"),
                    fieldMappings);
        } catch (Exception e) {
            throw new ActionException(ErrorCode.INTERNAL_ERROR, "绑定配置解析失败");
        }
    }

    private ActionDefinitionEntity findAction(String actionId) {
        String tenantId = TenantContext.getOrDefault();
        return actionDefinitionRepository
                .findByTenantIdAndActionIdAndDeletedAtIsNull(tenantId, actionId)
                .orElseThrow(() -> new ActionException(ErrorCode.ACTION_NOT_FOUND, "Action 不存在"));
    }

    private OntologyBindingResponse toResponse(ActionDefinitionEntity action, String inputEntityId,
                                               String outputEntityId,
                                               List<OntologyBindingRequest.FieldMapping> fieldMappings) {
        return OntologyBindingResponse.builder()
                .actionId(action.getActionId())
                .inputEntityId(inputEntityId)
                .outputEntityId(outputEntityId)
                .fieldMappings(fieldMappings)
                .updatedAt(action.getUpdatedAt())
                .build();
    }
}