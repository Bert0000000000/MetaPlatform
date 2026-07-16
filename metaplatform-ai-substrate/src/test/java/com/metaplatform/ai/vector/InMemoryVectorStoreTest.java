package com.metaplatform.ai.vector;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryVectorStoreTest {

    private InMemoryVectorStore vectorStore;

    @BeforeEach
    void setUp() {
        vectorStore = new InMemoryVectorStore();
    }

    @Test
    void shouldStoreAndRetrieveVector() {
        List<Float> vector = List.of(0.1f, 0.2f, 0.3f);
        vectorStore.store("test-collection", "doc-1", vector, Map.of("type", "text"));

        assertEquals(1, vectorStore.count("test-collection"));
    }

    @Test
    void shouldSearchByCosineSimilarity() {
        // Store several vectors
        vectorStore.store("docs", "doc-1", List.of(1.0f, 0.0f, 0.0f), Map.of("name", "Doc 1"));
        vectorStore.store("docs", "doc-2", List.of(0.0f, 1.0f, 0.0f), Map.of("name", "Doc 2"));
        vectorStore.store("docs", "doc-3", List.of(0.9f, 0.1f, 0.0f), Map.of("name", "Doc 3"));

        // Search for the vector most similar to [1, 0, 0]
        List<SearchResult> results = vectorStore.search("docs", List.of(1.0f, 0.0f, 0.0f), 2);

        assertEquals(2, results.size());
        assertEquals("doc-1", results.get(0).id());
        assertTrue(results.get(0).score() > 0.99f); // Exact match
        assertEquals("doc-3", results.get(1).id()); // Second most similar
    }

    @Test
    void shouldSearchWithFilter() {
        vectorStore.store("docs", "doc-1", List.of(1.0f, 0.0f),
                Map.of("category", "A", "name", "Doc 1"));
        vectorStore.store("docs", "doc-2", List.of(1.0f, 0.0f),
                Map.of("category", "B", "name", "Doc 2"));
        vectorStore.store("docs", "doc-3", List.of(1.0f, 0.0f),
                Map.of("category", "A", "name", "Doc 3"));

        List<SearchResult> results = vectorStore.search("docs", List.of(1.0f, 0.0f), 10,
                Map.of("category", "A"));

        assertEquals(2, results.size());
        assertTrue(results.stream().allMatch(r ->
                "A".equals(r.metadata().get("category"))));
    }

    @Test
    void shouldDeleteVector() {
        vectorStore.store("docs", "doc-1", List.of(1.0f, 0.0f), Map.of());
        assertEquals(1, vectorStore.count("docs"));

        vectorStore.delete("docs", "doc-1");
        assertEquals(0, vectorStore.count("docs"));
    }

    @Test
    void shouldDeleteCollection() {
        vectorStore.store("docs", "doc-1", List.of(1.0f), Map.of());
        vectorStore.store("docs", "doc-2", List.of(0.0f), Map.of());

        vectorStore.deleteCollection("docs");
        assertEquals(0, vectorStore.count("docs"));
    }

    @Test
    void shouldReturnEmptyForNonexistentCollection() {
        List<SearchResult> results = vectorStore.search("nonexistent", List.of(1.0f), 10);
        assertTrue(results.isEmpty());
    }

    @Test
    void shouldBatchStore() {
        List<VectorStore.VectorEntry> entries = List.of(
                new VectorStore.VectorEntry("a", List.of(1.0f, 0.0f), Map.of("key", "a")),
                new VectorStore.VectorEntry("b", List.of(0.0f, 1.0f), Map.of("key", "b"))
        );

        vectorStore.storeBatch("batch-test", entries);
        assertEquals(2, vectorStore.count("batch-test"));
    }

    @Test
    void shouldRejectDimensionMismatch() {
        vectorStore.store("docs", "doc-1", List.of(1.0f, 0.0f), Map.of());

        assertThrows(IllegalArgumentException.class, () ->
                vectorStore.search("docs", List.of(1.0f, 0.0f, 0.0f), 10));
    }
}
