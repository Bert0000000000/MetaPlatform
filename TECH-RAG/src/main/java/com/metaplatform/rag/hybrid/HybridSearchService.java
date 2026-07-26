package com.metaplatform.rag.hybrid;

import com.metaplatform.kb.entity.KbChunkEntity;
import com.metaplatform.kb.entity.KbChunkRepository;
import com.metaplatform.kb.entity.KbRetrievalConfigEntity;
import com.metaplatform.kb.entity.KbRetrievalConfigRepository;
import com.metaplatform.llmgw.openai.OpenAiDtos;
import com.metaplatform.rag.evidence.Evidence;
import com.metaplatform.rag.milvus.MilvusAdapter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class HybridSearchService {
    private final KbChunkRepository chunkRepository;
    private final KbRetrievalConfigRepository configRepository;
    private final MilvusAdapter milvusAdapter;

    public List<Evidence> search(String tenantId, String query, KbRetrievalConfigEntity cfg) {
        log.info("[HybridSearchService] STUB - full hybrid search deferred to P2.2.2; tenant={} config={}", tenantId, cfg == null ? "default" : cfg.getConfigId());
        return List.of();
    }
    public OpenAiDtos.EmbeddingResponse embed(String text) {
        OpenAiDtos.Usage usage = new OpenAiDtos.Usage(0, 0, 0);
        return new OpenAiDtos.EmbeddingResponse("list", java.util.List.of(), "model", usage);
    }
    public KbRetrievalConfigEntity getConfig(String tenantId) { return configRepository.findByTenantId(tenantId).stream().findFirst().orElse(null); }
    public List<KbChunkEntity> findChunks(String documentId) { return chunkRepository.findByDocumentId(documentId); }
}
