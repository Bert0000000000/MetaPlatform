package com.metaplatform.llmgw.routing;

import org.springframework.ai.chat.model.ChatModel;

public interface ModelRouter {

    boolean supports(String modelName);

    ChatModel route(String modelName);
}
