package com.metaplatform.copilot.dto;

import java.util.List;
import java.util.Map;

public record ChatResponse(String sessionId, String userMessageId, String assistantMessageId, String content, List<String> citations, List<Map<String, Object>> agentCalls) {
}