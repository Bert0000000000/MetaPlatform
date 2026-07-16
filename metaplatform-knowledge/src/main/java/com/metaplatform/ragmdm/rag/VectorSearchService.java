package com.metaplatform.ragmdm.rag;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class VectorSearchService {

    private final RestTemplate restTemplate;

    @Value("${metaplatform.rag.ai-substrate.base-url}")
    private String baseUrl;

    @Value("${metaplatform.rag.ai-substrate.vector-search-path:/api/v1/vector/search}")
    private String vectorSearchPath;

    private static final String VECTOR_STORE_PATH = "/api/v1/vector/store";

    /**
     * 存储单个向量
     */
    public void store(String id, float[] embedding, Map<String, Object> metadata) {
        VectorStoreRequest request = new VectorStoreRequest();
        request.setId(id);
        request.setEmbedding(embedding);
        request.setMetadata(metadata);

        try {
            restTemplate.postForObject(baseUrl + VECTOR_STORE_PATH, request, Void.class);
        } catch (Exception e) {
            log.error("Vector store failed for id={}: {}", id, e.getMessage());
            throw new RuntimeException("Vector store failed", e);
        }
    }

    /**
     * 批量存储向量
     */
    public void storeBatch(List<VectorEntry> entries) {
        if (entries.isEmpty()) return;

        VectorBatchStoreRequest request = new VectorBatchStoreRequest();
        request.setEntries(entries.stream().map(e -> {
            VectorStoreRequest r = new VectorStoreRequest();
            r.setId(e.id());
            r.setEmbedding(e.embedding());
            r.setMetadata(e.metadata());
            return r;
        }).toList());

        try {
            restTemplate.postForObject(baseUrl + VECTOR_STORE_PATH + "/batch", request, Void.class);
        } catch (Exception e) {
            log.error("Vector batch store failed: {}", e.getMessage());
            throw new RuntimeException("Vector batch store failed", e);
        }
    }

    /**
     * 语义搜索: 根据查询向量查找最相似的 Top-K 结果
     */
    public List<VectorSearchResult> search(float[] queryEmbedding, int topK,
                                            Map<String, Object> filter) {
        VectorSearchRequest request = new VectorSearchRequest();
        request.setQueryEmbedding(queryEmbedding);
        request.setTopK(topK);
        request.setFilter(filter);

        try {
            VectorSearchResponse response = restTemplate.postForObject(
                baseUrl + vectorSearchPath, request, VectorSearchResponse.class);

            if (response == null || response.getResults() == null) {
                return List.of();
            }
            return response.getResults();
        } catch (Exception e) {
            log.error("Vector search failed: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * 删除指定文档的所有向量
     */
    public void deleteByDocumentId(Long documentId) {
        try {
            restTemplate.delete(baseUrl + VECTOR_STORE_PATH + "/filter?documentId={id}", documentId);
        } catch (Exception e) {
            log.warn("Vector delete failed for documentId={}: {}", documentId, e.getMessage());
        }
    }

    // === DTO ===
    @Data
    public static class VectorStoreRequest {
        private String id;
        private float[] embedding;
        private Map<String, Object> metadata;
    }

    @Data
    public static class VectorBatchStoreRequest {
        private List<VectorStoreRequest> entries;
    }

    @Data
    public static class VectorSearchRequest {
        private float[] queryEmbedding;
        private int topK;
        private Map<String, Object> filter;
    }

    @Data
    public static class VectorSearchResponse {
        private List<VectorSearchResult> results;
    }

    @Data
    public static class VectorSearchResult {
        private String id;
        private double score;
        private Map<String, Object> metadata;
    }

    public record VectorEntry(
        String id,
        float[] embedding,
        Map<String, Object> metadata
    ) {}
}
