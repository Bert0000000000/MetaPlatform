package com.metaplatform.rag.hybrid;

import com.metaplatform.kb.entity.KbChunkEntity;
import com.metaplatform.kb.entity.KbChunkRepository;
import com.metaplatform.kb.entity.KbRetrievalConfigEntity;
import com.metaplatform.kb.entity.KbRetrievalConfigRepository;
import com.metaplatform.llmgw.openai.OpenAiDtos;
import com.metaplatform.rag.evidence.Evidence;
import com.metaplatform.rag.milvus.VectorStoreClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Hybrid retrieval service. The KbChunk / KbRetrievalConfig repositories live in
 * the APP-KB module and are only auto-discovered when APP-KB is on the classpath.
 * We wire them with @Autowired(required=false) so TECH-RAG can boot standalone
 * (e.g. when used from TECH-AGENT over HTTP RAGClient) and degrade gracefully when
 * the cross-module repos are missing.
 */
@Slf4j
@Service
public class HybridSearchService {

    private KbChunkRepository chunkRepository;
    private KbRetrievalConfigRepository configRepository;
    private VectorStoreClient vectorStore;

    @Autowired(required = false)
    public HybridSearchService(KbChunkRepository chunkRepository,
                              KbRetrievalConfigRepository configRepository,
                              VectorStoreClient vectorStore) {
        this.chunkRepository = chunkRepository;
        this.configRepository = configRepository;
        this.vectorStore = vectorStore;
    }

    public List<Evidence> search(String tenantId, String query, KbRetrievalConfigEntity cfg) {
        return search(tenantId, query, cfg, Map.of());
    }

    /** Scope-aware retrieval entry point used by ontology-native runtimes. */
    public List<Evidence> search(String tenantId, String query, KbRetrievalConfigEntity cfg,
                                 Map<String, Object> ontologyScope) {
        int topK = (cfg != null && cfg.getTopK() != null) ? cfg.getTopK() : 5;
        log.info("[HybridSearchService] search tenant={} config={} query='{}' topK={}",
                tenantId, cfg == null ? "default" : cfg.getConfigId(), query, topK);

        if (vectorStore == null) {
            log.warn("[HybridSearchService] no VectorStoreClient, returning empty");
            return new ArrayList<>();
        }
        if (query == null || query.isBlank()) {
            return new ArrayList<>();
        }

        List<Float> queryVector = pseudoEmbed(query, 1024);
        List<VectorStoreClient.SearchResult> hits = vectorStore.hybridSearch("kb_chunks", queryVector, query, topK, mergeTenantScope(tenantId, ontologyScope));

        List<Evidence> evidences = new ArrayList<>(hits.size());
        for (VectorStoreClient.SearchResult hit : hits) {
            String chunkId = hit.recordId();
            try {
                if (chunkRepository == null) {
                    evidences.add(Evidence.synthetic(chunkId, hit.score(), tenantId, hit.metadata()));
                    continue;
                }
                var chunkOpt = chunkRepository.findById(chunkId);
                if (chunkOpt.isPresent()) {
                    evidences.add(Evidence.fromChunk(chunkOpt.get(), hit.score(), tenantId));
                } else {
                    evidences.add(Evidence.synthetic(chunkId, hit.score(), tenantId, hit.metadata()));
                }
            } catch (Exception e) {
                log.debug("[HybridSearchService] evidence hydration failed for {}: {}", chunkId, e.getMessage());
            }
        }
        log.info("[HybridSearchService] returned {} evidences", evidences.size());
        return evidences;
    }

    private Map<String, Object> mergeTenantScope(String tenantId, Map<String, Object> scope) {
        Map<String, Object> merged = new java.util.LinkedHashMap<>();
        merged.put("tenantId", tenantId);
        if (scope != null) merged.putAll(scope);
        merged.put("tenantId", tenantId);
        return merged;
    }

    public OpenAiDtos.EmbeddingResponse embed(String text) {
        OpenAiDtos.Usage usage = new OpenAiDtos.Usage(0, 0, 0);
        return new OpenAiDtos.EmbeddingResponse("list", java.util.List.of(), "model", usage);
    }

    public KbRetrievalConfigEntity getConfig(String tenantId) {
        if (configRepository == null) {
            log.debug("[HybridSearchService] configRepository unavailable");
            return null;
        }
        return configRepository.findByTenantId(tenantId).stream().findFirst().orElse(null);
    }

    public List<KbChunkEntity> findChunks(String documentId) {
        if (chunkRepository == null) {
            log.debug("[HybridSearchService] chunkRepository unavailable");
            return java.util.Collections.emptyList();
        }
        return chunkRepository.findByDocumentId(documentId);
    }

    static List<Float> pseudoEmbed(String text, int dim) {
        List<Float> vec = new ArrayList<>(dim);
        long seed = text.hashCode();
        java.util.Random r = new java.util.Random(seed);
        for (int i = 0; i < dim; i++) {
            vec.add((float) (r.nextGaussian() * 0.1));
        }
        int[] charFreq = new int[26];
        for (char c : text.toLowerCase().toCharArray()) {
            if (c >= 'a' && c <= 'z') charFreq[c - 'a']++;
        }
        for (int i = 0; i < Math.min(26, dim); i++) {
            vec.set(i, vec.get(i) + charFreq[i] * 0.05f);
        }
        return vec;
    }
}
