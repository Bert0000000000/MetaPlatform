package com.metaplatform.dialogue.interfaces.rest.dto;

import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.intent.IntentCategory;

import java.util.Map;

/**
 * 意图响应DTO。
 */
public record IntentResponse(
        String id,
        String name,
        IntentCategory category,
        double confidence,
        Map<String, String> parameters,
        String rawText
) {
    public static IntentResponse from(Intent intent) {
        return new IntentResponse(
                intent.id().value(),
                intent.name(),
                intent.category(),
                intent.confidence(),
                intent.parameters(),
                intent.rawText()
        );
    }
}
