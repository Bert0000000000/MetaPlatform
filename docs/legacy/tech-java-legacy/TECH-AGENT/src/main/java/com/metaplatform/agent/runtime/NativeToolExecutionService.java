package com.metaplatform.agent.runtime;

import com.metaplatform.agent.middleware.MiddlewareChain;
import com.metaplatform.agent.middleware.MiddlewareContext;
import com.metaplatform.agent.middleware.ToolCall;
import com.metaplatform.agent.tools.GroundToolRequest;
import com.metaplatform.agent.tools.GroundToolService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;

/** Executes ontology read tools through the same middleware/evidence path for Native and DeerFlow. */
@Service
@RequiredArgsConstructor
public class NativeToolExecutionService {
    private final MiddlewareChain middlewareChain;
    private final GroundToolService groundToolService;

    public Map<String, Object> execute(MiddlewareContext context, String toolName, Map<String, Object> arguments) {
        if (context == null || context.getOntologyContext() == null) {
            throw new IllegalArgumentException("signed ontology context is required");
        }
        ToolCall call = ToolCall.builder().toolName(toolName).arguments(arguments).build();
        middlewareChain.runBeforeToolCall(context, call);
        if (context.isRejected()) {
            throw new IllegalStateException("tool call rejected: " + context.getRejectionReason());
        }
        var envelope = context.getOntologyContext();
        Map<String, Object> result = groundToolService.invoke(toolName, GroundToolRequest.builder()
                .envelopeId(envelope.envelopeId()).input(arguments == null ? Map.of() : arguments).build());
        middlewareChain.runAfterToolCall(context, call, result);
        return result;
    }
}
