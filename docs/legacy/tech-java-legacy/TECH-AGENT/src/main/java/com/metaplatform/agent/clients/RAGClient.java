package com.metaplatform.agent.clients;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.common.ErrorCode;
import com.metaplatform.agent.config.AgentProperties;
import com.metaplatform.agent.exception.AgentException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * TECH-RAG 服务客户端。
 *
 * <p>当 {@code mate.agent.rag-base-url} 为空时，返回确定性 mock 响应，
 * 使执行引擎在没有上游服务时也能运行。</p>
 */
@Slf4j
@Component
public class RAGClient {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final WebClient webClient;
    private final AgentProperties properties;
    private final ObjectMapper objectMapper;

    public RAGClient(@Qualifier("ragWebClient") WebClient webClient,
                     AgentProperties properties,
                     ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * 检索知识库。
     *
     * @param query             查询文本
     * @param knowledgeBaseIds  知识库 ID 列表（可空）
     * @param topK              返回条数上限
     * @param tenantId          租户 ID
     * @param traceId           链路追踪 ID（可空）
     * @return 检索结果列表，每条含 content / score / source / metadata
     */
    public List<Map<String, Object>> search(String query,
                                            List<String> knowledgeBaseIds,
                                            int topK,
                                            String tenantId,
                                            String traceId) {
        String baseUrl = properties.getRagBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockSearch(query, knowledgeBaseIds, topK);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("query", query);
        payload.put("topK", topK);
        if (knowledgeBaseIds != null && !knowledgeBaseIds.isEmpty()) {
            payload.put("knowledgeBaseIds", knowledgeBaseIds);
        }

        try {
            String json = webClient.post()
                    .uri("/api/v1/rag/search")
                    .header(HttpHeaders.CONTENT_TYPE, "application/json")
                    .header("X-Tenant-Id", tenantId == null ? "" : tenantId)
                    .header("X-Trace-Id", traceId == null ? "" : traceId)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            Map<String, Object> envelope = objectMapper.readValue(json, MAP_TYPE);
            Object data = envelope.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                Object items = dataMap.get("items");
                if (items instanceof List<?> itemList) {
                    return castToListMap(itemList);
                }
            } else if (data instanceof List<?> dataList) {
                return castToListMap(dataList);
            }
            return List.of();
        } catch (WebClientResponseException ex) {
            log.error("RAG 检索失败 | query={} status={}", query, ex.getStatusCode(), ex);
            throw new AgentException(ErrorCode.RAG_UNAVAILABLE,
                    "RAG 检索失败: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("RAG 检索异常 | query={}", query, ex);
            throw new AgentException(ErrorCode.RAG_UNAVAILABLE,
                    "RAG 检索失败: " + ex.getMessage(), ex);
        }
    }

    /**
     * 列出可用知识库。
     */
    public List<Map<String, Object>> listKnowledgeBases(String tenantId, String traceId) {
        String baseUrl = properties.getRagBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockListKnowledgeBases();
        }

        try {
            String json = webClient.get()
                    .uri("/api/v1/rag/knowledge-bases")
                    .header("X-Tenant-Id", tenantId == null ? "" : tenantId)
                    .header("X-Trace-Id", traceId == null ? "" : traceId)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            Map<String, Object> envelope = objectMapper.readValue(json, MAP_TYPE);
            Object data = envelope.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                Object items = dataMap.get("items");
                if (items instanceof List<?> itemList) {
                    return castToListMap(itemList);
                }
            } else if (data instanceof List<?> dataList) {
                return castToListMap(dataList);
            }
            return List.of();
        } catch (WebClientResponseException ex) {
            log.error("知识库列表查询失败 | status={}", ex.getStatusCode(), ex);
            throw new AgentException(ErrorCode.RAG_UNAVAILABLE,
                    "知识库列表查询失败: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("知识库列表查询异常", ex);
            throw new AgentException(ErrorCode.RAG_UNAVAILABLE,
                    "知识库列表查询失败: " + ex.getMessage(), ex);
        }
    }

    /**
     * 将检索结果格式化为 LLM 上下文字符串。
     */
    public String formatContext(List<Map<String, Object>> results) {
        if (results == null || results.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < results.size(); i++) {
            Map<String, Object> r = results.get(i);
            String content = strOrDefault(r.get("content"), "");
            String source = strOrDefault(r.get("source"), "");
            double score = r.get("score") instanceof Number n ? n.doubleValue() : 0.0;
            if (i > 0) {
                sb.append("\n\n");
            }
            sb.append("[").append(i + 1).append("] (来源: ").append(source)
              .append(", 相关度: ").append(String.format("%.2f", score)).append(")\n")
              .append(content);
        }
        return sb.toString();
    }

    // ----------------------------------------------------------- mock helpers

    private List<Map<String, Object>> mockSearch(String query, List<String> knowledgeBaseIds, int topK) {
        String kb = knowledgeBaseIds != null && !knowledgeBaseIds.isEmpty()
                ? String.join(", ", knowledgeBaseIds) : "default";
        int count = Math.min(topK, 3);
        List<Map<String, Object>> results = new java.util.ArrayList<>();
        for (int i = 0; i < count; i++) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("content", "检索结果 " + (i + 1) + "：关于「" + query + "」的知识片段（来源知识库: " + kb + "）。");
            r.put("score", Math.round((0.95 - i * 0.1) * 100.0) / 100.0);
            r.put("source", "kb-" + kb);
            r.put("metadata", Map.of("chunkIndex", i, "query", query));
            results.add(r);
        }
        return results;
    }

    private List<Map<String, Object>> mockListKnowledgeBases() {
        Map<String, Object> kb1 = new LinkedHashMap<>();
        kb1.put("knowledgeBaseId", "kb-procurement");
        kb1.put("name", "采购知识库");
        kb1.put("description", "采购流程、供应商管理相关知识");
        kb1.put("documentCount", 128);

        Map<String, Object> kb2 = new LinkedHashMap<>();
        kb2.put("knowledgeBaseId", "kb-finance");
        kb2.put("name", "财务知识库");
        kb2.put("description", "财务报销、预算管理相关知识");
        kb2.put("documentCount", 256);

        return List.of(kb1, kb2);
    }

    private static String strOrDefault(Object obj, String def) {
        return obj == null ? def : obj.toString();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castToListMap(List<?> list) {
        return list.stream()
                .filter(item -> item instanceof Map<?, ?>)
                .map(item -> (Map<String, Object>) item)
                .toList();
    }
}
