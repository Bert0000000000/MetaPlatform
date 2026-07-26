package com.metaplatform.rag.hybrid;

import com.metaplatform.kb.entity.KbChunkEntity;
import com.metaplatform.kb.entity.KbChunkRepository;
import com.metaplatform.kb.entity.KbRetrievalConfigEntity;
import com.metaplatform.kb.entity.KbRetrievalConfigRepository;
import com.metaplatform.rag.evidence.Evidence;
import com.metaplatform.rag.milvus.InMemoryVectorStoreClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P2.3 HybridSearchService - end-to-end query -> embed -> search -> Evidence.
 */
@DisplayName("P2.3 HybridSearchService end-to-end")
class HybridSearchServiceTest {

    private KbChunkRepository chunkRepo;
    private KbRetrievalConfigRepository configRepo;
    private InMemoryVectorStoreClient vectorStore;
    private HybridSearchService service;

    @BeforeEach
    void setUp() {
        chunkRepo = Mockito.mock(KbChunkRepository.class);
        configRepo = Mockito.mock(KbRetrievalConfigRepository.class);
        vectorStore = new InMemoryVectorStoreClient();
        service = new HybridSearchService(chunkRepo, configRepo, vectorStore);
    }

    @Test
    @DisplayName("end-to-end: ingest chunks, query, verify Evidence returned")
    void endToEnd() {
        vectorStore.createCollectionIfMissing("kb_chunks", 4);
        vectorStore.insert("kb_chunks", List.of(
                Map.of("id", "CHUNK-1", "vector", List.of(1.0f, 0.0f, 0.0f, 0.0f), "text", "Customer CUST-10086 is a KEY_ACCOUNT"),
                Map.of("id", "CHUNK-2", "vector", List.of(0.0f, 1.0f, 0.0f, 0.0f), "text", "Customer CUST-10087 is a STANDARD"),
                Map.of("id", "CHUNK-3", "vector", List.of(0.9f, 0.1f, 0.0f, 0.0f), "text", "Customer CUST-10088 churn risk")
        ));
        Mockito.when(configRepo.findByTenantId("T1")).thenReturn(List.of());

        var results = service.search("T1", "KEY_ACCOUNT customer info", null);

        assertFalse(results.isEmpty());
        assertTrue(results.stream().allMatch(e -> e.getEvidenceId() != null && e.getScore() > 0));
    }

    @Test
    @DisplayName("end-to-end: KB chunk lookup hydrates real Evidence")
    void endToEndWithKbLookup() {
        KbChunkEntity chunk = KbChunkEntity.builder()
                .chunkId("CHUNK-KB-1")
                .documentId("DOC-1")
                .content("Order ORD-2026-001 is overdue")
                .tenantId("T1")
                .build();
        Mockito.when(chunkRepo.findById("CHUNK-KB-1")).thenReturn(Optional.of(chunk));

        vectorStore.createCollectionIfMissing("kb_chunks", 4);
        vectorStore.insert("kb_chunks", List.of(
                Map.of("id", "CHUNK-KB-1", "vector", List.of(1.0f, 0.0f, 0.0f, 0.0f), "text", "Order ORD-2026-001 is overdue")
        ));

        var results = service.search("T1", "overdue order info", null);

        assertEquals(1, results.size());
        Evidence ev = results.get(0);
        assertEquals("DOC-1", ev.getDocumentId());
        assertEquals("CHUNK-KB-1", ev.getKbId());
        assertEquals(Evidence.Type.DOCUMENT, ev.getType());
        assertTrue(ev.getFragment().contains("ORD-2026-001"));
    }

    @Test
    @DisplayName("end-to-end: empty query returns empty list")
    void endToEndEmptyQuery() {
        assertTrue(service.search("T1", "", null).isEmpty());
        assertTrue(service.search("T1", null, null).isEmpty());
        assertTrue(service.search("T1", "   ", null).isEmpty());
    }

    @Test
    @DisplayName("end-to-end: respects config topK")
    void endToEndTopK() {
        KbRetrievalConfigEntity cfg = KbRetrievalConfigEntity.builder()
                .configId("cfg-1")
                .tenantId("T1")
                .topK(1)
                .build();
        Mockito.when(configRepo.findByTenantId("T1")).thenReturn(List.of(cfg));

        vectorStore.createCollectionIfMissing("kb_chunks", 4);
        for (int i = 0; i < 5; i++) {
            vectorStore.insert("kb_chunks", List.of(
                    Map.of("id", "CHUNK-" + i, "vector", List.of(1.0f - i*0.1f, 0.0f, 0.0f, 0.0f), "text", "chunk " + i)
            ));
        }

        var results = service.search("T1", "chunk 0 1 2 3 4", cfg);
        assertTrue(results.size() <= 1);
    }

    @Test
    @DisplayName("end-to-end: pseudoEmbed is deterministic")
    void pseudoEmbedDeterministic() {
        var v1 = HybridSearchService.pseudoEmbed("hello world", 4);
        var v2 = HybridSearchService.pseudoEmbed("hello world", 4);
        assertEquals(v1, v2);
    }
}
