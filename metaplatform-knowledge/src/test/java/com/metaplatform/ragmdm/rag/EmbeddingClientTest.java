package com.metaplatform.ragmdm.rag;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EmbeddingClientTest {

    @Test
    void cosineSimilarityIdenticalVectors() {
        float[] a = {1.0f, 0.0f, 0.0f};
        float[] b = {1.0f, 0.0f, 0.0f};
        double result = EmbeddingClient.cosineSimilarity(a, b);
        assertEquals(1.0, result, 0.0001);
    }

    @Test
    void cosineSimilarityOrthogonalVectors() {
        float[] a = {1.0f, 0.0f, 0.0f};
        float[] b = {0.0f, 1.0f, 0.0f};
        double result = EmbeddingClient.cosineSimilarity(a, b);
        assertEquals(0.0, result, 0.0001);
    }

    @Test
    void cosineSimilarityOppositeVectors() {
        float[] a = {1.0f, 0.0f};
        float[] b = {-1.0f, 0.0f};
        double result = EmbeddingClient.cosineSimilarity(a, b);
        assertEquals(-1.0, result, 0.0001);
    }

    @Test
    void cosineSimilarityDimensionMismatch() {
        float[] a = {1.0f, 0.0f};
        float[] b = {1.0f, 0.0f, 0.0f};
        assertThrows(IllegalArgumentException.class, () ->
            EmbeddingClient.cosineSimilarity(a, b));
    }

    @Test
    void cosineSimilarityZeroVector() {
        float[] a = {0.0f, 0.0f};
        float[] b = {1.0f, 0.0f};
        double result = EmbeddingClient.cosineSimilarity(a, b);
        assertEquals(0.0, result, 0.0001);
    }
}
