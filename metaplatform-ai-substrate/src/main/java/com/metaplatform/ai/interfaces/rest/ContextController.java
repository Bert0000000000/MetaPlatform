package com.metaplatform.ai.interfaces.rest;

import com.metaplatform.ai.context.ContextStore;
import com.metaplatform.ai.interfaces.rest.dto.ContextApiRequest;
import com.metaplatform.ai.llm.LlmRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/context")
public class ContextController {

    private final ContextStore contextStore;

    public ContextController(ContextStore contextStore) {
        this.contextStore = contextStore;
    }

    @PostMapping("/{sessionId}/messages")
    public ResponseEntity<Void> addMessage(
            @PathVariable String sessionId,
            @RequestBody ContextApiRequest request) {
        contextStore.addMessage(sessionId, new LlmRequest.ChatMessage(request.role(), request.content()));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{sessionId}/messages")
    public ResponseEntity<List<Map<String, String>>> getMessages(
            @PathVariable String sessionId,
            @RequestParam(required = false) Integer limit) {

        List<LlmRequest.ChatMessage> messages = limit != null ?
                contextStore.getRecentMessages(sessionId, limit) :
                contextStore.getMessages(sessionId);

        List<Map<String, String>> result = messages.stream()
                .map(m -> Map.of("role", m.role(), "content", m.content()))
                .toList();

        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> clearContext(@PathVariable String sessionId) {
        contextStore.clear(sessionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{sessionId}/count")
    public ResponseEntity<Map<String, Object>> getCount(@PathVariable String sessionId) {
        return ResponseEntity.ok(Map.of("sessionId", sessionId, "count", contextStore.getMessageCount(sessionId)));
    }
}
