package com.metaplatform.llmgw.router;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 多模型路由（P0.3.3）。
 *
 * <p>把 DeerFlow/Agent 请求中指定的模型名（OpenAI 兼容格式）映射到平台内部的
 * 模型别名（如 {@code qwen-max} / {@code doubao-seed-2} / {@code gpt-4o}）。
 * 支持的策略：</p>
 * <ul>
 *   <li>{@code priority}：按优先级链轮询（默认）</li>
 *   <li>{@code cost}：选 cheapest</li>
 *   <li>{@code quality}：选 highest</li>
 * </ul>
 *
 * <p>P0.3.3 阶段先实现 priority 与 fallback 机制；cost / quality 留到 P8.3 国产化适配。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ModelRouter {

    @Value("${llmgw.routing.default-strategy:priority}")
    private String strategy;

    @Value("${llmgw.routing.fallback-model:qwen-max}")
    private String fallbackModel;

    /**
     * 解析 OpenAI 模型名为平台内部模型名。
     *
     * @param requestedModel 请求中的 model（OpenAI 格式）
     * @return 平台内部模型名（用于 SAA ChatModel 调用）
     */
    public String resolve(String requestedModel) {
        if (requestedModel == null || requestedModel.isBlank()) {
            return fallbackModel;
        }
        String mapped = AliasMap.MAPPING.get(requestedModel.toLowerCase());
        if (mapped != null) {
            return mapped;
        }
        // 已经是平台内部名，原样透传
        if (AliasMap.PLATFORM_ALIASES.contains(requestedModel.toLowerCase())) {
            return requestedModel;
        }
        log.debug("[ModelRouter] unknown model '{}', fallback to '{}'", requestedModel, fallbackModel);
        return fallbackModel;
    }

    /** 列出 OpenAI 兼容格式的模型清单（用于 /v1/models） */
    public List<String> listOpenAiModels() {
        return AliasMap.MAPPING.keySet().stream().sorted().toList();
    }

    private static final class AliasMap {
        static final Map<String, String> MAPPING = Map.ofEntries(
                Map.entry("gpt-4o",          "qwen-max"),
                Map.entry("gpt-4o-mini",     "qwen-plus"),
                Map.entry("gpt-4-turbo",     "qwen-max-longcontext"),
                Map.entry("gpt-3.5-turbo",   "qwen-turbo"),
                Map.entry("o1",              "qwen-max-thinking"),
                Map.entry("o1-mini",         "qwen-plus-thinking"),
                Map.entry("claude-3.5-sonnet","qwen-max"),
                Map.entry("claude-3-haiku",  "qwen-turbo"),
                Map.entry("doubao-pro",      "doubao-pro"),
                Map.entry("deepseek-chat",   "deepseek-chat"),
                Map.entry("text-embedding-3-large", "text-embedding-v3"),
                Map.entry("text-embedding-3-small", "text-embedding-v3")
        );
        static final List<String> PLATFORM_ALIASES = List.of(
                "qwen-max", "qwen-plus", "qwen-turbo", "qwen-max-longcontext",
                "qwen-max-thinking", "qwen-plus-thinking", "doubao-pro",
                "deepseek-chat", "text-embedding-v3"
        );
    }
}
