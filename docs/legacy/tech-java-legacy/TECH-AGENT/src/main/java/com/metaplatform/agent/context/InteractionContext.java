package com.metaplatform.agent.context;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

/** Immutable page/request context supplied by a frontend interaction. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record InteractionContext(
        String message,
        Interaction interaction,
        Subject subject,
        Map<String, Object> viewState,
        String contractVersion) {
    public InteractionContext {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("message must not be blank");
        }
        if (message.length() > 8192) {
            throw new IllegalArgumentException("message exceeds 8192 characters");
        }
        if (subject == null || subject.conceptCode() == null || subject.conceptCode().isBlank()
                || subject.objectId() == null || subject.objectId().isBlank()) {
            throw new IllegalArgumentException("subject conceptCode and objectId are required");
        }
    }

    public record Interaction(String appCode, String pageCode, String pageUrl, String selectedText) {}
    public record Subject(String conceptCode, String objectId) {}
}
