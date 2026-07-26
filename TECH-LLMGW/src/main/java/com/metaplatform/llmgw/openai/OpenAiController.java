package com.metaplatform.llmgw.openai;

import com.metaplatform.llmgw.chat.dto.ChatMessage;
import com.metaplatform.llmgw.chat.dto.ChatRequest;
import com.metaplatform.llmgw.chat.service.ChatStreamService;
import com.metaplatform.llmgw.chat.dto.ChatResponse;
import com.metaplatform.llmgw.chat.service.ChatService;
import com.metaplatform.llmgw.router.ModelRouter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * OpenAI 闁稿繒鍘ч鎰博椤栨粌浠柨娑樻恭0.3.2闁挎稑顦埀?
 *
 * <p>閻?DeerFlow Adapter 闂侇偅淇虹换?{@code base_url=https://llmgw/v1} 闁烩晛鐡ㄧ敮瀵告嫬閸愵亝鏆忛柨?
 * <ul>
 *   <li>POST /v1/chat/completions</li>
 *   <li>GET  /v1/models</li>
 *   <li>POST /v1/embeddings闁挎稑婢僼ub闁挎稑鑻ˇ鏌ユ偨?/api/v1/llmgw/embeddings闁?/li>
 * </ul>
 * </p>
 */
@Slf4j
@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
public class OpenAiController {

    private final ChatService chatService;
    private final ChatStreamService chatStreamService;
    private final ModelRouter modelRouter;

    /**
     * /v1/chat/completions闁挎稑婀抏erFlow Adapter 濞戞挻妲掗惃鐔兼偨閵娿儱寮抽柛娆欑秶缁辨岸濡?
     * 閻犲洭鏀遍惇鐗堟媴閹捐娅氶柣?OpenAI 闁告绻楅鍛存晬濞夊敄er 閻庢稒顨嗛宀勫箹閸濆嫮鏁?metaplatform 濞戞挻鑹炬慨鐔肩叕椤愨€虫暅闁?
     */
    @PostMapping(value = "/chat/completions", produces = MediaType.APPLICATION_JSON_VALUE)
    public OpenAiDtos.ChatResponse chatCompletions(@RequestBody OpenAiDtos.ChatRequest req) {
        String platformModel = modelRouter.resolve(req.model());
        log.info("[OpenAI] /v1/chat/completions model={} -> {}", req.model(), platformModel);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("sourceProtocol", "openai");
        metadata.put("requestedModel", req.model());
        metadata.put("resolvedModel", platformModel);
        if (req.user() != null && !req.user().isBlank()) {
            metadata.put("userId", req.user());
        }

        List<ChatMessage> messages = convertMessages(req.messages());
        ChatRequest chatRequest = new ChatRequest(
                platformModel,
                messages,
                req.temperature(),
                req.topP(),
                req.maxTokens(),
                null,
                req.stream() != null && req.stream(),
                metadata.isEmpty() ? null : metadata
        );
        ChatResponse resp = chatService.chat(chatRequest);

        // 闁硅泛锕ら柦鈺呭矗?ChatResponse 閺夌儐鍓氶崹?OpenAI 闁告绻楅?
        List<OpenAiDtos.ChatChoice> choices = resp.choices() == null ? List.of() :
                resp.choices().stream().map(c -> new OpenAiDtos.ChatChoice(
                        0,
                        Map.of("role", "assistant", "content", c.message() == null ? "" : c.message().toString()),
                        c.finishReason() == null ? "stop" : c.finishReason()
                )).toList();
        OpenAiDtos.Usage usage = resp.usage() == null ? new OpenAiDtos.Usage(0, 0, 0) :
                new OpenAiDtos.Usage(resp.usage().promptTokens(), resp.usage().completionTokens(), resp.usage().totalTokens());

        return new OpenAiDtos.ChatResponse(
                resp.id() == null ? "chatcmpl-" + java.util.UUID.randomUUID() : resp.id(),
                "chat.completion",
                Instant.now().getEpochSecond(),
                platformModel,
                choices,
                usage,
                "metaplatform-llmgw-v1"
        );
    }

    /**
     * 婵炵繝绀佺槐锟犲传瀹ュ懐瀹夐柨娑樻汞SE闁挎稑顦埀?
     */
    @PostMapping(value = "/chat/completions", params = "stream=true", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> chatCompletionsStream(@RequestBody OpenAiDtos.ChatRequest req) {
        // Stream response via ChatStreamService, returning SSE chunks.
        String platformModel = modelRouter.resolve(req.model());
        List<ChatMessage> messages = convertMessages(req.messages());
        ChatRequest chatRequest = new ChatRequest(
                platformModel,
                messages,
                req.temperature(),
                req.topP(),
                req.maxTokens(),
                null,
                true,
                Map.of("sourceProtocol", "openai", "requestedModel", req.model())
        );
        return chatStreamService.stream(chatRequest)
                .map(chunk -> ServerSentEvent.<String>builder().data(chunk).build());
    }

    /**
     * /v1/models (called by DeerFlow Adapter / LangChain init).
     */
    @GetMapping("/models")
    public OpenAiDtos.ModelList listModels() {
        long now = Instant.now().getEpochSecond();
        List<OpenAiDtos.Model> models = modelRouter.listOpenAiModels().stream()
                .map(id -> new OpenAiDtos.Model(id, "model", now, "metaplatform"))
                .toList();
        return new OpenAiDtos.ModelList("list", models);
    }

    /**
     * /v1/embeddings placeholder (P2.2 TECH-RAG).
     */
    @PostMapping("/embeddings")
    public OpenAiDtos.ErrorBody embeddings(@RequestBody OpenAiDtos.EmbeddingRequest req) {
        log.info("[OpenAI] /v1/embeddings model={} - forward to TECH-RAG (P2.2 TBD)", req.model());
        return new OpenAiDtos.ErrorBody(new OpenAiDtos.Error(
                "embeddings not yet implemented; use POST /api/v1/llmgw/embeddings (P2.2 TBD)",
                "not_implemented",
                "501"
        ));
    }

    private List<ChatMessage> convertMessages(List<Map<String, Object>> rawMessages) {
        if (rawMessages == null) return List.of();
        List<ChatMessage> result = new ArrayList<>(rawMessages.size());
        for (Map<String, Object> m : rawMessages) {
            String role = m.get("role") == null ? "user" : String.valueOf(m.get("role"));
            Object content = m.get("content");
            String text = content == null ? "" : String.valueOf(content);
            result.add(new ChatMessage(role, text));
        }
        return result;
    }
}

