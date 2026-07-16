package com.metaplatform.ai.vector;

import java.util.List;
import java.util.Map;

/**
 * Vector store interface.
 * v0.1 uses in-memory implementation; will be replaced by Milvus in future versions.
 */
public interface VectorStore {

    /**
     * Store a vector
     */
    void store(String collection, String id, List<Float> vector, Map<String, Object> metadata);

    /**
     * Batch store vectors
     */
    void storeBatch(String collection, List<VectorEntry> entries);

    /**
     * Similarity search (cosine similarity)
     */
    List<SearchResult> search(String collection, List<Float> queryVector, int topK);

    /**
     * Similarity search with filter
     */
    List<SearchResult> search(String collection, List<Float> queryVector, int topK,
                               Map<String, Object> filter);

    /**
     * Delete a vector
     */
    void delete(String collection, String id);

    /**
     * Delete an entire collection
     */
    void deleteCollection(String collection);

    /**
     * Get the vector count in a collection
     */
    long count(String collection);

    record VectorEntry(
        String id,
        List<Float> vector,
        Map<String, Object> metadata
    ) {}
}
