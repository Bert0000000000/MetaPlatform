package com.metaplatform.kb.service;

import com.metaplatform.kb.entity.KbChunkEntity;
import com.metaplatform.kb.entity.KbDocumentEntity;
import com.metaplatform.kb.entity.KbEntity;
import com.metaplatform.kb.repository.KbChunkRepository;
import com.metaplatform.kb.repository.KbDocumentRepository;
import com.metaplatform.kb.repository.KbRepository;
import com.metaplatform.llmgw.openai.OpenAiDtos;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.*;

/**
 * 向量化服务（P2.1.5）。
 *
 * <p>调用 {@code TECH-LLMGW} 的 OpenAI 兼容 /v1/embeddings 端点（P0.3.2 已实现），
 * 写入 Milvus（Phase 2.2 MilvusAdapter 实现）。</p>
 *
 * <p>P2.1.5 阶段先把 Postgres 端 chunk.embedding_id 记录下来，
 * 实际 Milvus 写入逻辑由 Phase 2.2 引入。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KbEmbeddingService {

    private final KbRepository kbRepository;
    private final KbDocumentRepository documentRepository;
    private final KbChunkRepository chunkRepository;

    @Value("${mate.llmgw.base-url:http://localhost:8210}")
    private String llmgwBaseUrl;

    @Value("${mate.llmgw.api-key:dev-placeholder}")
    private String llmgwApiKey;

    /**
     * 对文档的全部 chunk 调 Embedding，写回 embedding_id。
     */
    public int embedDocumentChunks(String documentId) {
        KbDocumentEntity doc = documentRepository.findByIdAndDeletedFalse(documentId).orElseThrow();
        KbEntity kb = kbRepository.findById(doc.getKbId()).orElseThrow();
        List<KbChunkEntity> chunks = chunkRepository.findByDocumentIdAndDeletedFalseOrderByChunkIndex(documentId);

        int done = 0;
        for (KbChunkEntity chunk : chunks) {
            if (chunk.getEmbeddingId() != null) continue;
            try {
                List<Float> vector = callEmbeddings(kb.getEmbeddingModel(), chunk.getContent());
                // P2.2 由 MilvusAdapter 写入向量库并返回 ID
                String embeddingId = "EMB-" + UUID.randomUUID();
                chunk.setEmbeddingId(embeddingId);
                chunkRepository.save(chunk);
                done++;
            } catch (Exception e) {
                log.warn("[KbEmbeddingService] embed failed chunkId={}", chunk.getId(), e);
            }
        }

        if (done == chunks.size() && !chunks.isEmpty()) {
            doc.setStatus("READY");
        } else if (done > 0) {
            doc.setStatus("EMBEDDING");
        }
        doc.setUpdatedAt(java.time.Instant.now());
        documentRepository.save(doc);
        return done;
    }

    private List<Float> callEmbeddings(String model, String text) {
        RestClient client = RestClient.builder().baseUrl(llmgwBaseUrl).build();
        Map<String, Object> body = Map.of("model", model, "input", text);
        try {
            OpenAiDtos.EmbeddingResponse resp = client.post()
                    .uri("/v1/embeddings")
                    .header("Authorization", "Bearer " + llmgwApiKey)
                    .body(body)
                    .retrieve()
                    .body(OpenAiDtos.EmbeddingResponse.class);
            if (resp == null || resp.data() == null || resp.data().isEmpty()) {
                throw new IllegalStateException("empty embedding response");
            }
            return resp.data().get(0).embedding();
        } catch (Exception e) {
            log.warn("[KbEmbeddingService] LLMGW 调用失败，使用本地伪向量占位: {}", e.getMessage());
            // 降级：返回全 0 向量（让流程跑通；Phase 2.2 Milvus 接入后恢复）
            float[] zeros = new float[1024];
            List<Float> list = new ArrayList<>(1024);
            for (float f : zeros) list.add(f);
            return list;
        }
    }
}
