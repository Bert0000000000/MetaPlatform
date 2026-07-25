package com.metaplatform.llmgw.chat.dto;

import java.util.List;
import java.util.Map;

public record ChatMessage(
    String role,
    String content,
    List<Map<String, Object>> multimodalContent,
    String toolCallId,
    Map<String, Object> metadata
) {
    public ChatMessage(String role, String content) {
        this(role, content, null, null, null);
    }
}
