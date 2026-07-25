package com.metaplatform.llmgw.code.service;

import com.metaplatform.llmgw.code.dto.GenerateCodeRequest;
import com.metaplatform.llmgw.code.dto.GenerateCodeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CodeGenerationService {

    private final ChatModel chatModel;

    private static final String SYSTEM_PROMPT = "You are an expert programmer. Generate clean, production-ready code. Only return code, no explanation.";

    public GenerateCodeResponse generateCode(GenerateCodeRequest request) {
        String userPrompt = buildUserPrompt(request);
        Prompt prompt = new Prompt(
                List.of(new SystemMessage(SYSTEM_PROMPT), new UserMessage(userPrompt)),
                ChatOptions.builder()
                        .temperature(0.2)
                        .maxTokens(2048)
                        .build()
        );
        org.springframework.ai.chat.model.ChatResponse response = chatModel.call(prompt);
        String code = extractCode(response);
        return new GenerateCodeResponse(code, request.language());
    }

    private String buildUserPrompt(GenerateCodeRequest request) {
        StringBuilder builder = new StringBuilder();
        if (request.language() != null && !request.language().isBlank()) {
            builder.append("Generate code in ").append(request.language()).append(".\n\n");
        }
        if (request.context() != null && !request.context().isBlank()) {
            builder.append("Context:\n").append(request.context()).append("\n\n");
        }
        builder.append(request.prompt());
        return builder.toString();
    }

    private String extractCode(org.springframework.ai.chat.model.ChatResponse response) {
        if (response == null || response.getResult() == null || response.getResult().getOutput() == null) {
            return "";
        }
        String content = response.getResult().getOutput().getText();
        return content == null ? "" : content;
    }
}
