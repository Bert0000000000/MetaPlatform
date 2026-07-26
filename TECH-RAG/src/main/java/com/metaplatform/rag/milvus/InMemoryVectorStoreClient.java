package com.metaplatform.rag.milvus;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * P2.2 InMemoryVectorStoreClient - default in-memory implementation.
 *
 * <p>Used for tests / dev when no real Milvus is available.
 * Stores vectors in ConcurrentHashMap and computes cosine similarity on demand.
 * Activated when {@code mate.rag.vector-store=memory} (the default).</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "mate.rag.vector-store", havingValue = "memory", matchIfMissing = true)
public class InMemoryVectorStoreClient implements VectorStoreClient {

    private final Map<String, List<Map<String, Object>>> collections = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Map<String, Object>>> recordsByCollection = new ConcurrentHashMap<>();

    @Override
    public List<SearchResult> search(String collection, List<Float> vector, int topK) {
        List<Map<String, Object>> records = recordsByCollection.getOrDefault(collection, Map.of())
                .values().stream().toList();
        return records.stream()
                .map(r -> {
                    @SuppressWarnings("unchecked")
                    List<Float> v = (List<Float>) r.get("vector");
                    float score = v == null ? 0f : cosineSimilarity(vector, v);
                    String id = String.valueOf(r.getOrDefault("id", r.getOrDefault("chunk_id", "unknown")));
                    Map<String, Object> meta = new java.util.HashMap<>();
                    if (r.get("metadata") instanceof Map) meta.putAll((Map<String, Object>) r.get("metadata"));
                    if (r.get("text") != null) meta.put("text", r.get("text"));
                    if (r.get("id") != null) meta.put("id", r.get("id"));
                    return new SearchResult(id, score, meta);
                })
                .sorted((a, b) -> Float.compare(b.score(), a.score()))
                .limit(topK)
                .toList();
    }

    @Override
    public List<SearchResult> hybridSearch(String collection, List<Float> vector, String text, int topK) {
        // Simple hybrid: 0.7 * vector_score + 0.3 * bm25_score
        List<SearchResult> vectorResults = search(collection, vector, topK * 2);
        if (text == null || text.isBlank()) return vectorResults.stream().limit(topK).toList();
        String[] terms = text.toLowerCase().split("\s+");
        return vectorResults.stream()
                .filter(r -> {
                    String t2 = String.valueOf(r.metadata().getOrDefault("text", "")).toLowerCase();
                    for (String term : terms) if (t2.contains(term)) return true;
                    return false;
                })
                .map(r -> {
                    String text2 = String.valueOf(r.metadata().getOrDefault("text", "")).toLowerCase();
                    long matchCount = Arrays.stream(terms).filter(text2::contains).count();
                    float bm25 = (float) matchCount / Math.max(terms.length, 1);
                    float combined = 0.7f * r.score() + 0.3f * bm25;
                    return new SearchResult(r.recordId(), combined, r.metadata());
                })
                .sorted((a, b) -> Float.compare(b.score(), a.score()))
                .limit(topK)
                .toList();
    }

    @Override
    public void insert(String collection, List<Map<String, Object>> records) {
        Map<String, Map<String, Object>> map = recordsByCollection.computeIfAbsent(collection, k -> new ConcurrentHashMap<>());
        for (Map<String, Object> r : records) {
            String id = String.valueOf(r.getOrDefault("id", r.getOrDefault("chunk_id", UUID.randomUUID().toString())));
            map.put(id, r);
        }
        collections.computeIfAbsent(collection, k -> new ArrayList<>()).addAll(records);
    }

    @Override
    public void createCollectionIfMissing(String name, int dim) {
        recordsByCollection.computeIfAbsent(name, k -> new ConcurrentHashMap<>());
        log.info("[InMemoryVectorStore] collection={} dim={} created (no-op)", name, dim);
    }

    @Override
    public long count(String collection) {
        Map<String, Map<String, Object>> map = recordsByCollection.get(collection);
        return map == null ? 0 : map.size();
    }

    @Override
    public boolean isHealthy() { return true; }

    private static float cosineSimilarity(List<Float> a, List<Float> b) {
        if (a == null || b == null || a.size() != b.size() || a.isEmpty()) return 0f;
        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < a.size(); i++) {
            dot += a.get(i) * b.get(i);
            na += a.get(i) * a.get(i);
            nb += b.get(i) * b.get(i);
        }
        if (na == 0 || nb == 0) return 0f;
        return (float) (dot / (Math.sqrt(na) * Math.sqrt(nb)));
    }
}
