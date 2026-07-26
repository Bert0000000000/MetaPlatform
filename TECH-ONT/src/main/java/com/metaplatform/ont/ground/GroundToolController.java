package com.metaplatform.ont.ground;

import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.context.ContextException;
import com.metaplatform.ont.context.OntologyContextService;
import com.metaplatform.ont.metric.MetricService;
import com.metaplatform.ont.repository.EntityRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/agent/ground-tools")
@RequiredArgsConstructor
public class GroundToolController {
    private final OntologyContextService contextService;
    private final MetricService metricService;
    private final EntityRepository entityRepository;

    @PostMapping("/{toolName}")
    public Map<String,Object> invoke(@PathVariable String toolName, @RequestBody GroundToolRequest request) {
        var envelope = contextService.get(request.getEnvelopeId());
        if (!contextService.verify(envelope)) throw ContextException.forbidden("ENVELOPE_INVALID", "Envelope signature is invalid");
        if (envelope.getAllowedTools()==null || !envelope.getAllowedTools().contains(toolName))
            throw ContextException.forbidden("TOOL_NOT_IN_ALLOWLIST", "Tool is not allowed by envelope: " + toolName);
        if (!envelope.getTenantId().equals(TenantContext.tenantIdOrDefault()))
            throw ContextException.forbidden("TENANT_MISMATCH", "Envelope tenant does not match request tenant");
        return switch (toolName) {
            case "ontology.query_metric" -> queryMetric(envelope.getTenantId(), request.getInput());
            case "ontology.search_objects" -> searchObjects(envelope.getTenantId(), request.getInput());
            default -> throw ContextException.bad("TOOL_NOT_IMPLEMENTED", "Tool is not implemented: " + toolName);
        };
    }

    private Map<String,Object> searchObjects(String tenantId, Map<String,Object> input) {
        String conceptId = input == null || input.get("conceptId") == null ? null : String.valueOf(input.get("conceptId"));
        String keyword = input == null || input.get("keyword") == null ? "" : String.valueOf(input.get("keyword")).toLowerCase();
        int limit = input != null && input.get("limit") instanceof Number n ? Math.max(1, Math.min(n.intValue(), 50)) : 20;
        var source = conceptId == null || conceptId.isBlank()
                ? entityRepository.findByTenantId(tenantId)
                : entityRepository.findByTenantIdAndConceptId(tenantId, conceptId);
        var items = source.stream().filter(e -> keyword.isBlank()
                        || (e.getName()!=null && e.getName().toLowerCase().contains(keyword))
                        || (e.getCode()!=null && e.getCode().toLowerCase().contains(keyword)))
                .limit(limit).map(e -> Map.<String,Object>of("objectId", e.getEntityId(), "conceptId", e.getConceptId(),
                        "code", e.getCode()==null?"":e.getCode(), "name", e.getName()==null?"":e.getName()))
                .toList();
        return Map.of("items", items, "count", items.size());
    }

    private Map<String,Object> queryMetric(String tenantId, Map<String,Object> input) {
        String metricCode = required(input, "metricCode");
        String objectId = input.get("objectId") == null ? null : String.valueOf(input.get("objectId"));
        @SuppressWarnings("unchecked") Map<String,Object> params = input.get("params") instanceof Map<?,?> m ? (Map<String,Object>)m : Map.of();
        Object value = metricService.execute(tenantId, metricCode, objectId, params);
        return Map.of("metricCode", metricCode, "objectId", objectId == null ? "" : objectId, "value", value);
    }

    private String required(Map<String,Object> input, String key) {
        Object value=input==null?null:input.get(key);
        if (value==null || String.valueOf(value).isBlank()) throw ContextException.bad("TOOL_INPUT_INVALID", key + " is required");
        return String.valueOf(value);
    }

    @Data
    public static class GroundToolRequest { private String envelopeId; private Map<String,Object> input; }
}
