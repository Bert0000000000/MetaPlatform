package com.metaplatform.dialogue.interfaces.rest.dto;

import java.util.Map;

/**
 * 创建会话请求。
 */
public record CreateConversationRequest(
        String userId
) {}
