package com.metaplatform.ai.vector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory vector store: v0.1 temporary implementation, replacing Milvus.
 * Uses cosine similarity for search.
 */
@Component
public class InMemoryVectorStore implements VectorStore {

    private static final Logger log = LoggerFactory.getLogger(InMemoryVectorStore.class);

    /**
     * collection -> (id -> VectorDoc)
     */
    private final Map<String, Map<String, VectorDoc>> collections = new ConcurrentHashMap<>();

    @Override
    public void store(String collection, String id, List<Float> vector, Map<String, Object> metadata) {
        collections.computeIfAbsent(collection, k -> new ConcurrentHashMap<>())
                .put(id, new VectorDoc(id, vector, metadata != null ? metadata : Map.of()));
        log.debug("Stored vector in collection={}, id={}, dim={}", collection, id, vector.size());
    }

    @Override
    public void storeBatch(String collection, List<VectorEntry> entries) {
        Map<String, VectorDoc> store = collections.computeIfAbsent(collection, k -> new ConcurrentHashMap<>());
        for (VectorEntry entry : entries) {
            store.put(entry.id(), new VectorDoc(entry.id(), entry.vector(),
                    entry.metadata() != null ? entry.metadata() : Map.of()));
        }
        log.debug("Stored {} vectors in collection={}", entries.size(), collection);
    }

    @Override
    public List<SearchResult> search(String collection, List<Float> queryVector, int topK) {
        return search(collection, queryVector, topK, Map.of());
    }

    @Override
    public List<SearchResult> search(String collection, List<Float> queryVector, int topK,
                                      Map<String, Object> filter) {
        Map<String, VectorDoc> store = collections.get(collection);
        if (store == null || store.isEmpty()) {
            return List.of();
        }

        // Calculate cosine similarity for all vectors
        List<SearchResult> results = store.values().stream()
                .filter(doc -> matchesFilter(doc.metadata(), filter))
                .map(doc -> {
                    float score = cosineSimilarity(queryVector, doc.vector());
                    return new SearchResult(doc.id(), score, doc.metadata());
                })
                .sorted((a, b) -> Float.compare(b.score(), a.score()))
                .limit(topK)
                .toList();

        log.debug("Search in collection={}, topK={}, found={} results", collection, topK, results.size());
        return results;
    }

    @Override
    public void delete(String collection, String id) {
        Map<String, VectorDoc> store = collections.get(collection);
        if (store != null) {
            store.remove(id);
        }
    }

    @Override
    public void deleteCollection(String collection) {
        collections.remove(collection);
    }

    @Override
    public long count(String collection) {
        Map<String, VectorDoc> store = collections.get(collection);
        return store != null ? store.size() : 0;
    }

    /**
     * Calculate cosine similarity
     */
    static float cosineSimilarity(List<Float> a, List<Float> b) {
        if (a.size() != b.size()) {
            throw new IllegalArgumentException("Vector dimensions must match: " + a.size() + " vs " + b.size());
        }

        float dotProduct = 0;
        float normA = 0;
        float normB = 0;

        for (int i = 0; i < a.size(); i++) {
            float ai = a.get(i);
            float bi = b.get(i);
            dotProduct += ai * bi;
            normA += ai * ai;
            normB += bi * bi;
        }

        if (normA == 0 || normB == 0) return 0;

        return dotProduct / (float) (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private boolean matchesFilter(Map<String, Object> metadata, Map<String, Object> filter) {
        if (filter == null || filter.isEmpty()) return true;

        for (Map.Entry<String, Object> entry : filter.entrySet()) {
            Object metaValue = metadata.get(entry.getKey());
            if (!Objects.equals(metaValue, entry.getValue())) {
                return false;
            }
        }
        return true;
    }

    private record VectorDoc(
        String id,
        List<Float> vector,
        Map<String, Object> metadata
    ) {}
}
