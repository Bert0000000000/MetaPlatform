package com.metaplatform.rag.milvus;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.*;

/**
 * P2.2 MilvusHttpClient - production HTTP-based Milvus 2.5 client.
 *
 * <p>Activated when {@code mate.rag.vector-store=milvus} and
 * {@code mate.rag.milvus.url} is set. Talks to Milvus over its REST API
 * (port 19530 by default, or 9091 for HTTP).</p>
 *
 * <p>For the full SDK experience (gRPC, complex types) use the official
 * milvus-sdk-java; this HTTP shim is sufficient for retrieval-only flows.</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "mate.rag.vector-store", havingValue = "milvus")
public class MilvusHttpClient implements VectorStoreClient {

    private final RestClient client;
    private final String databaseUrl;

    public MilvusHttpClient(
            @org.springframework.beans.factory.annotation.Value("") String url) {
        this.databaseUrl = url;
        this.client = RestClient.builder().baseUrl(url).build();
        log.info("[MilvusHttpClient] initialized url={}", url);
    }

    @Override
    public List<SearchResult> search(String collection, List<Float> vector, int topK) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("collection_name", collection);
            body.put("vector", vector);
            body.put("top_k", topK);
            body.put("metric_type", "cosine");
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<Map> response = client.post()
                    .uri("/v1/vector/search")
                    .headers(h -> { h.addAll(headers); })
                    .body(body)
                    .retrieve()
                    .toEntity(Map.class);
            return parseResults(response.getBody());
        } catch (Exception e) {
            log.warn("[MilvusHttpClient] search failed: {}", e.getMessage());
            return List.of();
        }
    }

    @Override
    public List<SearchResult> hybridSearch(String collection, List<Float> vector, String text, int topK) {
        // For full hybrid, client would do a /v1/vector/hybrid_search call.
        // Simplified: do vector search and post-filter by text.
        List<SearchResult> vectorResults = search(collection, vector, topK);
        if (text == null || text.isBlank()) return vectorResults;
        String[] terms = text.toLowerCase().split("\s+");
        return vectorResults.stream()
                .filter(r -> {
                    String t = String.valueOf(r.metadata().getOrDefault("text", "")).toLowerCase();
                    for (String term : terms) if (t.contains(term)) return true;
                    return false;
                })
                .limit(topK)
                .toList();
    }

    @Override
    public void insert(String collection, List<Map<String, Object>> records) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("collection_name", collection);
            body.put("records", records);
            client.post().uri("/v1/vector/insert").body(body).retrieve().toBodilessEntity();  // ok - body() handles content-type
            log.info("[MilvusHttpClient] inserted {} records into {}", records.size(), collection);
        } catch (Exception e) {
            log.warn("[MilvusHttpClient] insert failed: {}", e.getMessage());
        }
    }

    @Override
    public void createCollectionIfMissing(String name, int dim) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("collection_name", name);
            body.put("dimension", dim);
            body.put("metric_type", "cosine");
            client.post().uri("/v1/vector/collections/create").body(body).retrieve().toBodilessEntity();
            log.info("[MilvusHttpClient] collection={} dim={} created", name, dim);
        } catch (Exception e) {
            log.debug("[MilvusHttpClient] collection {} may already exist: {}", name, e.getMessage());
        }
    }

    @Override
    public long count(String collection) {
        try {
            ResponseEntity<Map> response = client.get()
                    .uri("/v1/vector/collections/{}/stats", collection)
                    .retrieve()
                    .toEntity(Map.class);
            Object count = response.getBody() == null ? 0 : response.getBody().get("row_count");
            return count instanceof Number n ? n.longValue() : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }

    @Override
    public boolean isHealthy() {
        try {
            client.get().uri("/health").retrieve().toBodilessEntity();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private List<SearchResult> parseResults(Map body) {
        if (body == null) return List.of();
        Object data = body.get("data");
        if (!(data instanceof List)) return List.of();
        List<Map<String, Object>> rows = (List<Map<String, Object>>) data;
        List<SearchResult> out = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            String id = String.valueOf(row.getOrDefault("id", row.getOrDefault("chunk_id", "unknown")));
            float score = row.get("score") instanceof Number n ? n.floatValue() : 0f;
            Map<String, Object> meta = (Map<String, Object>) row.getOrDefault("metadata", Map.of());
            out.add(new SearchResult(id, score, meta));
        }
        return out;
    }
}
