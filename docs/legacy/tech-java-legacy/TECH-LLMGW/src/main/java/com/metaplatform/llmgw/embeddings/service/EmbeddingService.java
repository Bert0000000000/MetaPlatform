package com.metaplatform.llmgw.embeddings.service;

import com.metaplatform.llmgw.embeddings.dto.EmbeddingRequest;
import com.metaplatform.llmgw.embeddings.dto.EmbeddingResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingResponseMetadata;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EmbeddingService {

    private final EmbeddingModel embeddingModel;

    public EmbeddingResponse embed(EmbeddingRequest request) {
        org.springframework.ai.embedding.EmbeddingResponse saaResponse = embeddingModel.embedForResponse(request.input());
        String model = request.model();
        EmbeddingResponseMetadata metadata = saaResponse.getMetadata();
        if (metadata != null && metadata.getModel() != null && !metadata.getModel().isBlank()) {
            model = metadata.getModel();
        }
        List<EmbeddingResponse.EmbeddingData> data = new ArrayList<>();
        for (Embedding embedding : saaResponse.getResults()) {
            List<Float> vector = new ArrayList<>();
            for (float value : embedding.getOutput()) {
                vector.add(value);
            }
            data.add(new EmbeddingResponse.EmbeddingData(embedding.getIndex(), vector, "embedding"));
        }
        int promptTokens = 0;
        int totalTokens = 0;
        if (metadata != null && metadata.getUsage() != null) {
            org.springframework.ai.chat.metadata.Usage usage = metadata.getUsage();
            promptTokens = usage.getPromptTokens() != null ? usage.getPromptTokens() : 0;
            totalTokens = usage.getTotalTokens() != null ? usage.getTotalTokens() : 0;
        }
        return new EmbeddingResponse(model, data, new EmbeddingResponse.Usage(promptTokens, totalTokens));
    }
}
