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
    public List<SearchResult> hybridSearch(String collection, List<Float> vector, String text, int topK,
                                            Map<String, Object> ontologyFilter) {
        return hybridSearchInternal(collection, vector, text, topK, ontologyFilter);
    }

    @Override
    public List<SearchResult> hybridSearch(String collection, List<Float> vector, String text, int topK) {
        return hybridSearchInternal(collection, vector, text, topK, Map.of());
    }

    private List<SearchResult> hybridSearchInternal(String collection, List<Float> vector, String text, int topK, Map<String, Object> ontologyFilter) {
        // Score every record so lexical matches cannot be lost behind the vector top-K.
        List<Map<String, Object>> records = recordsByCollection.getOrDefault(collection, Map.of())
                .values().stream().toList();
        Set<String> terms = tokenize(text);
        return records.stream().filter(r -> matchesFilter(r, ontologyFilter)).map(r -> {
            List<Float> stored = (List<Float>) r.get("vector");
            float vectorScore = stored == null ? 0f : cosineSimilarity(vector, stored);
            String body = String.valueOf(r.getOrDefault("text", "")).toLowerCase(Locale.ROOT);
            long matched = terms.stream().filter(body::contains).count();
            float lexicalScore = terms.isEmpty() ? 0f : (float) matched / terms.size();
            String id = String.valueOf(r.getOrDefault("id", r.getOrDefault("chunk_id", "unknown")));
            return new SearchResult(id, 0.7f * vectorScore + 0.3f * lexicalScore, metadata(r));
        }).filter(r -> terms.isEmpty() || terms.stream().anyMatch(t -> String.valueOf(r.metadata().getOrDefault("text", "")).toLowerCase(Locale.ROOT).contains(t)))
          .sorted((a, b) -> Float.compare(b.score(), a.score())).limit(Math.max(0, topK)).toList();
    }


    private static boolean matchesFilter(Map<String, Object> record, Map<String, Object> filter) {
        if (filter == null || filter.isEmpty()) return true;
        Object raw = record.get("metadata");
        Map<?, ?> metadata = raw instanceof Map<?, ?> m ? m : Map.of();
        // Legacy records without scope metadata remain searchable; new ingesters should always set it.
        if (metadata.isEmpty() && filter.keySet().stream().noneMatch(record::containsKey)) return true;
        return filter.entrySet().stream().allMatch(e -> {
            Object actual = metadata.containsKey(e.getKey()) ? metadata.get(e.getKey()) : record.get(e.getKey());
            return Objects.equals(String.valueOf(actual), String.valueOf(e.getValue()));
        });
    }

    private static Set<String> tokenize(String text) {
        if (text == null || text.isBlank()) return Set.of();
        return new LinkedHashSet<>(Arrays.stream(text.toLowerCase(Locale.ROOT).split("\\s+")
                ).filter(t -> !t.isBlank()).toList());
    }

    private static Map<String, Object> metadata(Map<String, Object> record) {
        Map<String, Object> metadata = new HashMap<>();
        if (record.get("metadata") instanceof Map<?, ?> m) {
            m.forEach((k, v) -> metadata.put(String.valueOf(k), v));
        }
        if (record.get("text") != null) metadata.put("text", record.get("text"));
        if (record.get("id") != null) metadata.put("id", record.get("id"));
        return metadata;
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
