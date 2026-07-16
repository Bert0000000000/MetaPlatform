package com.metaplatform.ragmdm.rag;

import com.metaplatform.ragmdm.domain.Document;
import com.metaplatform.ragmdm.domain.DocumentChunk;
import com.metaplatform.ragmdm.domain.repository.DocumentChunkRepository;
import com.metaplatform.ragmdm.domain.repository.DocumentRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class RagQueryService {

    private final EmbeddingClient embeddingClient;
    private final VectorSearchService vectorSearchService;
    private final DocumentChunkRepository chunkRepository;
    private final DocumentRepository documentRepository;

    @Value("${metaplatform.rag.max-top-k:20}")
    private int maxTopK;

    /**
     * RAG 查询: 语义搜索最相关的文档块
     */
    public List<RagSearchResult> query(String query, Long knowledgeBaseId, int topK) {
        if (topK <= 0) topK = 5;
        if (topK > maxTopK) topK = maxTopK;

        // 1. 将查询文本转为向量
        float[] queryEmbedding = embeddingClient.embed(query);

        // 2. 构建过滤条件
        Map<String, Object> filter = new HashMap<>();
        if (knowledgeBaseId != null) {
            filter.put("knowledgeBaseId", knowledgeBaseId);
        }

        // 3. 向量搜索
        List<VectorSearchService.VectorSearchResult> vectorResults =
            vectorSearchService.search(queryEmbedding, topK, filter);

        // 4. 补充 Chunk 详情
        List<RagSearchResult> results = new ArrayList<>();
        for (VectorSearchService.VectorSearchResult vr : vectorResults) {
            Map<String, Object> metadata = vr.getMetadata();
            Long chunkId = metadata != null && metadata.containsKey("chunkId")
                ? toLong(metadata.get("chunkId")) : null;

            if (chunkId == null) continue;

            DocumentChunk chunk = chunkRepository.findById(chunkId).orElse(null);
            if (chunk == null) continue;

            Document doc = documentRepository.findById(chunk.getDocumentId()).orElse(null);

            RagSearchResult result = new RagSearchResult();
            result.setChunkId(chunk.getId());
            result.setContent(chunk.getContent());
            result.setScore(vr.getScore());
            result.setDocumentId(chunk.getDocumentId());
            result.setDocumentTitle(doc != null ? doc.getTitle() : null);
            result.setChunkIndex(chunk.getChunkIndex());
            result.setMetadata(metadata);
            results.add(result);
        }

        return results;
    }

    /**
     * 带上下文的 RAG 查询: 返回匹配块及其前后各一个块
     */
    public List<RagSearchResult> queryWithContext(String query, Long knowledgeBaseId, int topK) {
        List<RagSearchResult> results = query(query, knowledgeBaseId, topK);

        for (RagSearchResult result : results) {
            List<DocumentChunk> contextChunks = chunkRepository
                .findByDocumentIdAndChunkIndexIn(result.getDocumentId(),
                    List.of(result.getChunkIndex() - 1, result.getChunkIndex() + 1));

            for (DocumentChunk cc : contextChunks) {
                if (cc.getChunkIndex() < result.getChunkIndex()) {
                    result.setPrevChunkContent(cc.getContent());
                } else if (cc.getChunkIndex() > result.getChunkIndex()) {
                    result.setNextChunkContent(cc.getContent());
                }
            }
        }

        return results;
    }

    private Long toLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.longValue();
        return Long.parseLong(value.toString());
    }

    // === Result DTO ===
    @Data
    public static class RagSearchResult {
        private Long chunkId;
        private String content;
        private double score;
        private Long documentId;
        private String documentTitle;
        private Integer chunkIndex;
        private Map<String, Object> metadata;
        private String prevChunkContent;
        private String nextChunkContent;
    }
}
