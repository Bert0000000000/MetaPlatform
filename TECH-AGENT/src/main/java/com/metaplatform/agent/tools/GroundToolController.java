package com.metaplatform.agent.tools;

import com.metaplatform.agent.api.Phase1Exception;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/agent/ground-tools")
@RequiredArgsConstructor
public class GroundToolController {
    private static final Set<String> ALLOWED_TOOLS = Set.of(
            "ontology.search_objects", "ontology.query_metric",
            "ontology.get_object_graph", "ontology.fetch_evidence");

    @PostMapping("/{toolName}")
    public Map<String, Object> invoke(@PathVariable String toolName, @Valid @RequestBody GroundToolRequest request) {
        if (!ALLOWED_TOOLS.contains(toolName)) {
            throw Phase1Exception.forbidden("TOOL_NOT_IN_ALLOWLIST", "Tool is not allowed: " + toolName);
        }
        if (request.getEnvelopeId() == null || request.getEnvelopeId().isBlank()) {
            throw Phase1Exception.badRequest("ENVELOPE_REQUIRED", "A signed envelope reference is required");
        }
        if (request.getInput() != null && request.getInput().toString().length() > 16384) {
            throw Phase1Exception.badRequest("TOOL_INPUT_TOO_LARGE", "Tool input exceeds 16KB");
        }
        // Phase 1 deliberately returns a transport-safe mock result. The real DeerFlow
        // adapter is a later batch and must never bypass this allow-list gate.
        return Map.of("toolName", toolName, "envelopeId", request.getEnvelopeId(),
                "input", request.getInput(), "data", Map.of("status", "GROUNDING_ADAPTER_PENDING"));
    }
}

