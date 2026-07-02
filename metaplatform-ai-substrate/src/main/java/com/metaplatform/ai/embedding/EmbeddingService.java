package com.metaplatform.ai.embedding;

/**
 * Embedding service interface.
 */
public interface EmbeddingService {

    /**
     * Generate text embedding vectors.
     */
    EmbeddingResponse embed(EmbeddingRequest request);

    /**
     * Generate embeddings with Redis cache.
     */
    EmbeddingResponse embedWithCache(EmbeddingRequest request);
}
