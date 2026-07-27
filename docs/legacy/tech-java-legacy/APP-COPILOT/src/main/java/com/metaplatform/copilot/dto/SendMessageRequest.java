package com.metaplatform.copilot.dto;

public record SendMessageRequest(String userId, String content, String businessDomain) {
}