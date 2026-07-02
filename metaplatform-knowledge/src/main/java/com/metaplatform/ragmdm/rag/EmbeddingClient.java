package com.metaplatform.ragmdm.rag;

import com.metaplatform.ragmdm.common.exception.EmbeddingException;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmbeddingClient {

    private final RestTemplate restTemplate;

    @Value("${metaplatform.rag.ai-substrate.base-url}")
    private String baseUrl;

    @Value("${metaplatform.rag.ai-substrate.embedding-path:/api/v1/embeddings}")
    private String embeddingPath;

    /**
     * 获取单个文本的嵌入向量
     */
    public float[] embed(String text) {
        EmbeddingRequest request = new EmbeddingRequest();
        request.setModel("text-embedding-3-small");
        request.setInput(List.of(text));

        try {
            String url = baseUrl + embeddingPath;
            EmbeddingResponse response = restTemplate.postForObject(url, request, EmbeddingResponse.class);

            if (response == null || response.getData() == null || response.getData().isEmpty()) {
                throw new EmbeddingException("Embedding API returned empty result");
            }

            return response.getData().get(0).getEmbedding();
        } catch (EmbeddingException e) {
            throw e;
        } catch (Exception e) {
            throw new EmbeddingException("Failed to call embedding API: " + e.getMessage(), e);
        }
    }

    /**
     * 批量获取嵌入向量
     */
    public List<float[]> embedBatch(List<String> texts) {
        if (texts.isEmpty()) return List.of();

        EmbeddingRequest request = new EmbeddingRequest();
        request.setModel("text-embedding-3-small");
        request.setInput(texts);

        try {
            String url = baseUrl + embeddingPath;
            EmbeddingResponse response = restTemplate.postForObject(url, request, EmbeddingResponse.class);

            if (response == null || response.getData() == null) {
                throw new EmbeddingException("Embedding batch API returned empty result");
            }

            return response.getData().stream()
                .sorted(Comparator.comparingInt(EmbeddingData::getIndex))
                .map(EmbeddingData::getEmbedding)
                .toList();
        } catch (EmbeddingException e) {
            throw e;
        } catch (Exception e) {
            throw new EmbeddingException("Failed to call embedding batch API: " + e.getMessage(), e);
        }
    }

    /**
     * 计算两个向量的余弦相似度
     */
    public static double cosineSimilarity(float[] a, float[] b) {
        if (a.length != b.length) {
            throw new IllegalArgumentException("Vector dimensions mismatch: " + a.length + " vs " + b.length);
        }
        double dotProduct = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        double denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator == 0 ? 0 : dotProduct / denominator;
    }

    // === DTO ===
    @Data
    public static class EmbeddingRequest {
        private String model;
        private List<String> input;
    }

    @Data
    public static class EmbeddingResponse {
        private List<EmbeddingData> data;
        private String model;
        private Map<String, Object> usage;
    }

    @Data
    public static class EmbeddingData {
        private float[] embedding;
        private int index;
        private String object;
    }
}
