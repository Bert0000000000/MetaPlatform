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
            "ontology.describe_concept", "ontology.describe_relationship",
            "ontology.query_metric", "ontology.resolve_object");

    @PostMapping("/{toolName}")
    public Map<String, Object> invoke(@PathVariable String toolName, @Valid @RequestBody GroundToolRequest request) {
        if (!ALLOWED_TOOLS.contains(toolName)) {
            throw Phase1Exception.forbidden("TOOL_NOT_IN_ALLOWLIST", "Tool is not allowed: " + toolName);
        }
        // Phase 1 deliberately returns a transport-safe mock result. The real DeerFlow
        // adapter is a later batch and must never bypass this allow-list gate.
        return Map.of("toolName", toolName, "envelopeId", request.getEnvelopeId(),
                "input", request.getInput(), "data", Map.of("status", "GROUNDING_ADAPTER_PENDING"));
    }
}
