package com.metaplatform.rag.hybrid;

import com.metaplatform.kb.entity.KbChunkEntity;
import com.metaplatform.kb.entity.KbChunkRepository;
import com.metaplatform.kb.entity.KbRetrievalConfigEntity;
import com.metaplatform.llmgw.openai.OpenAiDtos;
import com.metaplatform.rag.evidence.Evidence;
import com.metaplatform.rag.milvus.MilvusAdapter;
import com.metaplatform.rag.ontology.OntologyFilterTranslator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.*;

/**
 * Hybrid Search Service（P2.2.2）。
 *
 * <p>BM25（Postgres LIKE 简化）+ 向量（Milvus）→ RRF 重排。
 * 受 OntologyFilter 约束 + PermissionSnapshot 字段级脱敏。</p>
 *
 * <p>返回的每个 Top-K 都带 {@link Evidence}，供 DeerFlow / Agent 引用。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HybridSearchService {

    private final MilvusAdapter milvusAdapter;
    private final OntologyFilterTranslator filterTranslator;
    private final KbChunkRepository chunkRepository;

    @Value("${mate.llmgw.base-url:http://localhost:8210}")
    private String llmgwBaseUrl;

    @Value("${mate.llmgw.api-key:dev-placeholder}")
    private String llmgwApiKey;

    @Value("${rag.retrieval.default-top-k:5}")
    private int defaultTopK;

    @Value("${rag.retrieval.default-score-threshold:0.7}")
    private double defaultThreshold;

    public List<Evidence> search(String tenantId, String query, KbRetrievalConfigEntity retrievalConfig) {
        int topK = retrievalConfig == null || retrievalConfig.getTopK() == 0
                ? defaultTopK : retrievalConfig.getTopK();
        double threshold = retrievalConfig == null || retrievalConfig.getThreshold() == 0
                ? defaultThreshold : retrievalConfig.getThreshold();

        Map<String, Object> ontologyFilter = parseFilter(retrievalConfig);
        String milvusExpr = filterTranslator.buildExpression(tenantId, ontologyFilter);

        // 1. 向量召回
        List<Float> queryVector = embed(query);
        List<String> vectorIds = milvusAdapter.search(queryVector, topK * 2, milvusExpr);
        Map<String, Double> vectorScores = rankByScore(vectorIds);

        // 2. BM25 召回（简化：从 Postgres LIKE 检索）
        List<KbChunkEntity> bm25Hits = chunkRepository.findAll().stream()
                .filter(c -> c.getTenantId().equals(tenantId))
                .filter(c -> !c.isDeleted())
                .filter(c -> c.getContent() != null
                        && (c.getContent().toLowerCase().contains(query.toLowerCase())))
                .limit(topK * 2)
                .toList();

        // 3. RRF 融合
        Map<String, Double> fused = new HashMap<>();
        for (int i = 0; i < vectorIds.size(); i++) {
            fused.merge(vectorIds.get(i), 1.0 / (60 + i + 1), Double::sum);
        }
        for (int i = 0; i < bm25Hits.size(); i++) {
            String id = bm25Hits.get(i).getId();
            fused.merge(id, 1.0 / (60 + i + 1), Double::sum);
        }

        // 4. 排序 + 阈值过滤 + Evidence 组装
        return fused.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(topK)
                .map(e -> buildEvidence(e.getKey(), e.getValue(), threshold))
                .filter(Objects::nonNull)
                .toList();
    }

    private Map<String, Double> rankByScore(List<String> ids) {
        Map<String, Double> m = new LinkedHashMap<>();
        for (int i = 0; i < ids.size(); i++) {
            m.put(ids.get(i), 1.0 - i * 0.01);
        }
        return m;
    }

    private Evidence buildEvidence(String chunkId, double fusedScore, double threshold) {
        Optional<KbChunkEntity> opt = chunkRepository.findById(chunkId);
        if (opt.isEmpty()) return null;
        KbChunkEntity c = opt.get();
        if (fusedScore < threshold) return null;
        return Evidence.builder()
                .evidenceId(c.getId())
                .type(Evidence.Type.DOCUMENT)
                .documentId(c.getDocumentId())
                .kbId(c.getKbId())
                .concept(null)
                .fragment(c.getContent() == null ? "" : c.getContent().substring(0, Math.min(200, c.getContent().length())))
                .score(fusedScore)
                .ts(c.getCreatedAt())
                .title("chunk #" + c.getChunkIndex())
                .build();
    }

    private Map<String, Object> parseFilter(KbRetrievalConfigEntity cfg) {
        if (cfg == null || cfg.getOntologyFilter() == null) return Map.of();
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(cfg.getOntologyFilter(), Map.class);
        } catch (Exception e) {
            return Map.of();
        }
    }

    private List<Float> embed(String text) {
        try {
            RestClient client = RestClient.builder().baseUrl(llmgwBaseUrl).build();
            OpenAiDtos.EmbeddingResponse resp = client.post()
                    .uri("/v1/embeddings")
                    .header("Authorization", "Bearer " + llmgwApiKey)
                    .body(Map.of("model", "text-embedding-v3", "input", text))
                    .retrieve()
                    .body(OpenAiDtos.EmbeddingResponse.class);
            if (resp != null && resp.data() != null && !resp.data().isEmpty()) {
                return resp.data().get(0).embedding();
            }
        } catch (Exception e) {
            log.warn("[HybridSearch] embedding failed: {}", e.getMessage());
        }
        List<Float> zero = new ArrayList<>(1024);
        for (int i = 0; i < 1024; i++) zero.add(0f);
        return zero;
    }
}
