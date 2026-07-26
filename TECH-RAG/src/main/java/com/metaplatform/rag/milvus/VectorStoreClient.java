package com.metaplatform.rag.milvus;

import java.util.List;
import java.util.Map;

/**
 * P2.2 Vector store client abstraction.
 *
 * <p>Defines the minimal surface for hybrid search / RAG pipelines:
 * <ul>
 *   <li>vector search (collection + query vector + topK)</li>
 *   <li>document insert (batch)</li>
 *   <li>collection management (create-if-missing)</li>
 *   <li>hybrid search (BM25 + vector fusion)</li>
 * </ul>
 *
 * <p>Implementations: {@code InMemoryVectorStoreClient} (default for tests/dev),
 * {@code MilvusHttpClient} (production), {@code NoopVectorStoreClient} (safety net).</p>
 */
public interface VectorStoreClient {

    /**
     * Search the topK most similar vectors in a collection.
     * @param collection collection name
     * @param vector query embedding
     * @param topK number of results to return
     * @return list of (recordId, score) tuples
     */
    List<SearchResult> search(String collection, List<Float> vector, int topK);

    /**
     * Hybrid search: combine vector similarity + BM25 keyword matching.
     * @param collection collection name
     * @param vector query embedding
     * @param text keyword query (BM25)
     * @param topK number of results
     * @return list of (recordId, score) tuples
     */
    List<SearchResult> hybridSearch(String collection, List<Float> vector, String text, int topK);

    /**
     * Insert a batch of records (each record must have a vector and an id).
     */
    void insert(String collection, List<Map<String, Object>> records);

    /**
     * Create the collection if it does not exist (idempotent).
     */
    void createCollectionIfMissing(String name, int dim);

    /**
     * Get collection stats (record count).
     */
    long count(String collection);

    /**
     * Health check: is the underlying vector store reachable.
     */
    boolean isHealthy();

    record SearchResult(String recordId, float score, Map<String, Object> metadata) {}
}
