package com.metaplatform.rag.search.service;

import com.metaplatform.rag.entity.SearchFeedbackEntity;
import com.metaplatform.rag.repository.SearchFeedbackRepository;
import com.metaplatform.rag.search.dto.SearchRequest;
import com.metaplatform.rag.search.dto.SearchResponse;
import com.metaplatform.rag.search.dto.SearchResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.rag.Query;
import org.springframework.ai.rag.preretrieval.query.expansion.QueryExpander;
import org.springframework.ai.rag.preretrieval.query.transformation.QueryTransformer;
import org.springframework.ai.rag.retrieval.search.DocumentRetriever;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final VectorStore vectorStore;
    private final EmbeddingModel embeddingModel;
    private final SearchFeedbackRepository searchFeedbackRepository;

    /**
     * SAA RAG 流水线组件（由 RetrievalAugmentorConfig 提供）。
     * 可能为 {@code null}：若未配置 / 类路径缺失则回退到纯向量检索。
     */
    private final ChatModel chatModel;
    private final org.springframework.beans.factory.ObjectProvider<QueryTransformer> queryTransformerProvider;
    private final org.springframework.beans.factory.ObjectProvider<QueryExpander> queryExpanderProvider;
    private final org.springframework.beans.factory.ObjectProvider<DocumentRetriever> documentRetrieverProvider;

    @Transactional(readOnly = true)
    public SearchResponse search(UUID kbId, SearchRequest request) {
        List<Document> docs = vectorStore.similaritySearch(
            org.springframework.ai.vectorstore.SearchRequest.builder()
                .query(request.query())
                .topK(request.topK() != null ? request.topK() : 5)
                .similarityThreshold(request.scoreThreshold() != null ? request.scoreThreshold().floatValue() : 0.7f)
                .filterExpression("kbId == '" + kbId + "'")
                .build()
        );
        List<SearchResult> results = docs.stream()
            .map(this::toSearchResult)
            .toList();
        return new SearchResponse(results);
    }

    @Transactional(readOnly = true)
    public SearchResponse hybridSearch(UUID kbId, SearchRequest request) {
        List<SearchResult> vectorResults = search(kbId, request).results();
        String keyword = request.query().toLowerCase();
        List<SearchResult> filtered = vectorResults.stream()
            .filter(r -> r.content() != null && r.content().toLowerCase().contains(keyword))
            .toList();
        return new SearchResponse(filtered);
    }

    public Flux<SearchResult> streamSearch(UUID kbId, SearchRequest request) {
        return Flux.fromIterable(search(kbId, request).results());
    }

    /**
     * 高级检索：QueryRewrite → QueryExpansion → DocumentRetrieval → Rerank → 压缩。
     *
     * <p>若 SAA RAG 组件（QueryTransformer / QueryExpander / DocumentRetriever）未注入，
     * 自动回退到 {@link #search(UUID, SearchRequest)} 纯向量检索，保持功能可用性。</p>
     */
    @Transactional(readOnly = true)
    public SearchResponse searchWithRewrite(UUID kbId, SearchRequest request) {
        QueryTransformer transformer = queryTransformerProvider.getIfAvailable();
        QueryExpander expander = queryExpanderProvider.getIfAvailable();
        DocumentRetriever retriever = documentRetrieverProvider.getIfAvailable();

        if (transformer == null || expander == null || retriever == null) {
            log.warn("SAA RAG pipeline components unavailable; falling back to plain vector search.");
            return search(kbId, request);
        }

        String originalQuery = request.query();
        Query rewrittenQuery;
        try {
            rewrittenQuery = transformer.transform(new Query(originalQuery));
        } catch (Exception e) {
            log.warn("QueryTransformer failed, fallback to original query", e);
            rewrittenQuery = new Query(originalQuery);
        }

        List<Query> expandedQueries;
        try {
            expandedQueries = expander.expand(rewrittenQuery);
            if (expandedQueries == null || expandedQueries.isEmpty()) {
                expandedQueries = List.of(rewrittenQuery);
            }
        } catch (Exception e) {
            log.warn("QueryExpander failed, fallback to rewritten query", e);
            expandedQueries = List.of(rewrittenQuery);
        }

        int topK = request.topK() != null ? request.topK() : 5;
        double threshold = request.scoreThreshold() != null ? request.scoreThreshold() : 0.7;
        String filter = "kbId == '" + kbId + "'";

        // 1) 改写后查询检索 + 2) 扩展查询多路检索（去重，按 score 排序）
        List<Document> allDocs = new ArrayList<>();
        Set<String> seenIds = new LinkedHashSet<>();
        for (Query q : expandedQueries) {
            List<Document> partial = vectorStore.similaritySearch(
                org.springframework.ai.vectorstore.SearchRequest.builder()
                    .query(q.text())
                    .topK(topK)
                    .similarityThreshold((float) threshold)
                    .filterExpression(filter)
                    .build()
            );
            for (Document d : partial) {
                String id = d.getId() != null ? d.getId() : d.getText();
                if (id != null && seenIds.add(id)) {
                    allDocs.add(d);
                }
            }
        }

        // 3) 简单重排：按 score 倒序，截断 topK
        List<Document> reranked = allDocs.stream()
            .sorted((a, b) -> {
                Double sa = a.getScore();
                Double sb = b.getScore();
                if (sa == null && sb == null) return 0;
                if (sa == null) return 1;
                if (sb == null) return -1;
                return Double.compare(sb, sa);
            })
            .limit(topK)
            .toList();

        List<SearchResult> results = reranked.stream()
            .map(this::toSearchResult)
            .toList();
        return new SearchResponse(results);
    }

    /**
     * 简化的查询改写检索：仅使用 ChatModel 改写 query 后做向量检索。
     * 不依赖 SAA RAG 流水线组件，作为兜底实现。
     */
    @Transactional(readOnly = true)
    public SearchResponse searchWithSimpleRewrite(UUID kbId, SearchRequest request) {
        String rewritten = originalQuery(request.query());
        List<Document> docs = vectorStore.similaritySearch(
            org.springframework.ai.vectorstore.SearchRequest.builder()
                .query(rewritten)
                .topK(request.topK() != null ? request.topK() : 5)
                .similarityThreshold(request.scoreThreshold() != null ? request.scoreThreshold().floatValue() : 0.7f)
                .filterExpression("kbId == '" + kbId + "'")
                .build()
        );
        List<SearchResult> results = docs.stream()
            .map(this::toSearchResult)
            .toList();
        return new SearchResponse(results);
    }

    private String originalQuery(String query) {
        if (chatModel == null || query == null || query.isBlank()) {
            return query;
        }
        try {
            org.springframework.ai.chat.prompt.Prompt prompt = new org.springframework.ai.chat.prompt.Prompt(
                "将以下查询改写为更具体、更适合知识库向量检索的查询（保持中文输出，不要解释）：\n" + query
            );
            String content = chatModel.call(prompt).getResult().getOutput().getText();
            return (content == null || content.isBlank()) ? query : content.trim();
        } catch (Exception e) {
            log.warn("SimpleQueryRewrite failed, fallback to original", e);
            return query;
        }
    }

    @Transactional
    public void saveFeedback(UUID kbId, UUID chunkId, String query, Double score, String feedbackType, String comment) {
        SearchFeedbackEntity feedback = new SearchFeedbackEntity();
        feedback.setQuery(query);
        feedback.setKbId(kbId);
        feedback.setChunkId(chunkId);
        feedback.setScore(score);
        feedback.setFeedbackType(feedbackType);
        feedback.setComment(comment);
        searchFeedbackRepository.save(feedback);
    }

    private SearchResult toSearchResult(Document doc) {
        Map<String, Object> metadata = doc.getMetadata();
        UUID chunkId = parseUuid(metadata.get("chunkId"));
        UUID docId = parseUuid(metadata.get("docId"));
        return new SearchResult(
            chunkId,
            docId,
            doc.getText(),
            doc.getScore() != null ? doc.getScore().doubleValue() : 0.0,
            docId != null ? "/api/v1/rag/documents/" + docId : null
        );
    }

    private UUID parseUuid(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(value.toString());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}