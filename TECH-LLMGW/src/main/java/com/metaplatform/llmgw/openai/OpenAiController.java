package com.metaplatform.llmgw.openai;

import com.metaplatform.llmgw.chat.dto.ChatRequest;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * OpenAI 兼容端点（P0.3.2）。
 *
 * <p>让 DeerFlow Adapter 通过 {@code base_url=https://llmgw/v1} 直接调用：
 * <ul>
 *   <li>POST /v1/chat/completions</li>
 *   <li>GET  /v1/models</li>
 *   <li>POST /v1/embeddings（stub，复用 /api/v1/llmgw/embeddings）</li>
 * </ul>
 * </p>
 */
@Slf4j
@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
public class OpenAiController {

    private final ChatService chatService;
    private final ModelRouter modelRouter;

    /**
     * /v1/chat/completions（DeerFlow Adapter 主调用入口）。
     * 请求体采用 OpenAI 协议；user 字段携带 metaplatform 业务身份。
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

        ChatRequest chatRequest = new ChatRequest(
                platformModel,
                req.messages(),
                req.temperature(),
                req.topP(),
                req.maxTokens(),
                req.stream() != null && req.stream(),
                metadata.isEmpty() ? null : metadata
        );
        ChatResponse resp = chatService.chat(chatRequest);

        // 把平台 ChatResponse 转成 OpenAI 协议
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
     * 流式响应（SSE）。
     */
    @PostMapping(value = "/chat/completions", params = "stream=true", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> chatCompletionsStream(@RequestBody OpenAiDtos.ChatRequest req) {
        // 流式响应直接复用平台流接口，转发 SSE 帧
        String platformModel = modelRouter.resolve(req.model());
        ChatRequest chatRequest = new ChatRequest(
                platformModel,
                req.messages(),
                req.temperature(),
                req.topP(),
                req.maxTokens(),
                true,
                Map.of("sourceProtocol", "openai", "requestedModel", req.model())
        );
        // ChatService / ChatStreamService 已存在；这里仅做参数包装
        return chatService.stream(chatRequest);
    }

    /**
     * /v1/models（DeerFlow Adapter / LangChain init 时调用）。
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
     * /v1/embeddings 占位（具体由 P2.2 TECH-RAG 提供向量能力，本处只做协议转发）。
     */
    @PostMapping("/embeddings")
    public OpenAiDtos.ErrorBody embeddings(@RequestBody OpenAiDtos.EmbeddingRequest req) {
        log.info("[OpenAI] /v1/embeddings model={} - 转发到 TECH-RAG（P2.2 实施）", req.model());
        return new OpenAiDtos.ErrorBody(new OpenAiDtos.Error(
                "embeddings 入口请使用 POST /api/v1/llmgw/embeddings（P2.2 落地）",
                "not_implemented",
                "501"
        ));
    }
}
