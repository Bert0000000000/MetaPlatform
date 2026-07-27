package com.metaplatform.llmgw.openai;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * OpenAI 兼容协议 DTO（P0.3.2）。
 *
 * <p>让 DeerFlow Adapter 可直接以 {@code base_url=https://llmgw/v1} 调用，
 * 无需修改 DeerFlow 上游代码。</p>
 *
 * <p>兼容范围：Chat Completions、Models 列表、Embeddings 三组端点。</p>
 */
public final class OpenAiDtos {

    private OpenAiDtos() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ChatRequest(
            String model,
            List<Map<String, Object>> messages,
            Double temperature,
            @JsonProperty("top_p") Double topP,
            @JsonProperty("max_tokens") Integer maxTokens,
            Boolean stream,
            String user,
            List<Map<String, Object>> tools,
            @JsonProperty("tool_choice") Object toolChoice
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ChatResponse(
            String id,
            String object,
            long created,
            String model,
            List<ChatChoice> choices,
            Usage usage,
            @JsonProperty("system_fingerprint") String systemFingerprint
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ChatChoice(
            int index,
            Map<String, Object> message,
            @JsonProperty("finish_reason") String finishReason
    ) {}

    public record Usage(
            @JsonProperty("prompt_tokens") int promptTokens,
            @JsonProperty("completion_tokens") int completionTokens,
            @JsonProperty("total_tokens") int totalTokens
    ) {}

    public record Model(
            String id,
            String object,
            long created,
            String ownedBy
    ) {}

    public record ModelList(
            String object,
            List<Model> data
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record EmbeddingRequest(
            String model,
            Object input,
            String user,
            @JsonProperty("encoding_format") String encodingFormat
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record EmbeddingResponse(
            String object,
            List<EmbeddingData> data,
            String model,
            Usage usage
    ) {}

    public record EmbeddingData(
            String object,
            int index,
            List<Float> embedding
    ) {}

    public record ErrorBody(
            Error error
    ) {}

    public record Error(
            String message,
            String type,
            String code
    ) {}
}
