package com.metaplatform.ont.context;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/ontology/context")
@RequiredArgsConstructor
public class OntologyContextController {
    private final OntologyContextService service;
    private final ObjectMapper objectMapper;

    @PostMapping("/build")
    public ResponseEntity<EnvelopeHandle> build(@Valid @RequestBody BuildEnvelopeRequest request) {
        BuildEnvelopeRequest.InteractionContextDto context = request.getInteractionContext();
        Map<String,Object> claims = claims(request.getUserJwt());
        String jwtTenant = first(claims, "tenantId", "tenant_id");
        String tenantId = jwtTenant == null ? TenantContext.tenantIdOrDefault() : jwtTenant;
        if (jwtTenant != null && context.getInteraction().getTenantId() != null
                && !jwtTenant.equals(context.getInteraction().getTenantId())) {
            throw ContextException.forbidden("INTERACTION_TENANT_MISMATCH", "Interaction tenant does not match JWT tenant");
        }
        String userId = first(claims, "userId", "user_id", "sub");
        if (userId == null) userId = Optional.ofNullable(TenantContext.getUserId()).orElse("anonymous");
        String message = normalize(context.getMessage());
        BuildEnvelopeRequest.SubjectDto subject = context.getSubject();
        OntologyContextService.OntologyContextRequest serviceRequest = OntologyContextService.OntologyContextRequest.builder()
                .tenantId(tenantId).userId(userId).runId("RUN-" + UUID.randomUUID().toString().replace("-", ""))
                .message(message).principalRoles(roles(claims))
                .subject(subject == null ? null : OntologyContextEnvelope.Subject.builder()
                        .conceptCode(subject.getConceptCode()).objectId(subject.getObjectId()).build())
                .properties(List.of()).relationships(List.of())
                .viewState(viewState(context.getViewState()))
                .build();
        OntologyContextEnvelope envelope = service.build(serviceRequest);
        return ResponseEntity.status(201).body(service.handle(envelope.getEnvelopeId()));
    }

    @GetMapping("/{envelopeId}")
    public OntologyContextEnvelope get(@PathVariable String envelopeId) {
        if (!envelopeId.matches("^ENV-[A-Za-z0-9_-]{8,32}$")) throw ContextException.bad("INVALID_ENVELOPE_ID", "Invalid envelope id");
        return service.get(envelopeId);
    }

    /** Retained internal verification hook; not part of the public Phase 1 list. */
    @PostMapping("/verify")
    public Map<String,Object> verify(@RequestBody OntologyContextEnvelope envelope) {
        return Map.of("valid", service.verify(envelope));
    }

    private Map<String,Object> viewState(BuildEnvelopeRequest.ViewStateDto state) {
        if (state == null) return null;
        Map<String,Object> values = new LinkedHashMap<>();
        if (state.getActiveTab() != null) values.put("activeTab", state.getActiveTab());
        values.put("filters", Optional.ofNullable(state.getFilters()).orElse(Map.of()));
        values.put("selectedMetrics", Optional.ofNullable(state.getSelectedMetrics()).orElse(List.of()));
        return values;
    }
    private Map<String,Object> claims(String token) {
        try { String[] parts = token.split("\\."); if (parts.length < 2) return Map.of();
            return objectMapper.readValue(Base64.getUrlDecoder().decode(parts[1]), new TypeReference<>() {}); }
        catch (Exception ignored) { return Map.of(); }
    }
    private List<String> roles(Map<String,Object> claims) { Object r = claims.get("roles"); if (r instanceof Collection<?> c) return c.stream().map(String::valueOf).toList(); return List.of(); }
    private String first(Map<String,Object> map, String... names) { for (String n:names) if (map.get(n)!=null && !String.valueOf(map.get(n)).isBlank()) return String.valueOf(map.get(n)); return null; }
    private String normalize(String value) { return value == null ? "" : value.trim().replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", "").replaceAll("\\s+", " "); }
}
