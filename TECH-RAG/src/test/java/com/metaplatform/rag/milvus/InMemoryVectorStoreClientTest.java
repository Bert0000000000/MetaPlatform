package com.metaplatform.rag.milvus;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P2.2 InMemoryVectorStoreClient - cosine similarity + hybrid search.
 */
@DisplayName("P2.2 InMemoryVectorStoreClient")
class InMemoryVectorStoreClientTest {

    private InMemoryVectorStoreClient client;

    @BeforeEach
    void setUp() {
        client = new InMemoryVectorStoreClient();
    }

    @Test
    @DisplayName("search: cosine similarity ranks results")
    void searchRanksBySimilarity() {
        client.createCollectionIfMissing("docs", 4);
        client.insert("docs", List.of(
                Map.of("id", "A", "vector", List.of(1.0f, 0.0f, 0.0f, 0.0f), "text", "hello world"),
                Map.of("id", "B", "vector", List.of(0.0f, 1.0f, 0.0f, 0.0f), "text", "foo bar"),
                Map.of("id", "C", "vector", List.of(0.9f, 0.1f, 0.0f, 0.0f), "text", "similar to A")
        ));

        var results = client.search("docs", List.of(1.0f, 0.0f, 0.0f, 0.0f), 2);
        assertEquals(2, results.size());
        assertEquals("A", results.get(0).recordId());
        assertTrue(results.get(0).score() > 0.99f);
        assertEquals("C", results.get(1).recordId());
    }

    @Test
    @DisplayName("hybridSearch: boosts results that match keywords")
    void hybridSearchBoostsKeywords() {
        client.createCollectionIfMissing("docs", 4);
        client.insert("docs", List.of(
                Map.of("id", "A", "vector", List.of(1.0f, 0.0f, 0.0f, 0.0f), "text", "kotlin coroutines"),
                Map.of("id", "B", "vector", List.of(0.5f, 0.5f, 0.0f, 0.0f), "text", "java virtual threads")
        ));

        var results = client.hybridSearch("docs", List.of(1.0f, 0.0f, 0.0f, 0.0f), "kotlin", 2);
        assertEquals(1, results.size());
        assertEquals("A", results.get(0).recordId());
    }

    @Test
    @DisplayName("insert + count + isHealthy")
    void healthAndCount() {
        assertTrue(client.isHealthy());
        client.createCollectionIfMissing("docs", 3);
        assertEquals(0, client.count("docs"));
        client.insert("docs", List.of(Map.of("id", "x", "vector", List.of(1.0f, 2.0f, 3.0f))));
        assertEquals(1, client.count("docs"));
    }

    @Test
    @DisplayName("search: empty collection returns empty")
    void searchEmpty() {
        client.createCollectionIfMissing("missing", 4);
        assertTrue(client.search("missing", List.of(1.0f, 0.0f), 5).isEmpty());
    }
}
