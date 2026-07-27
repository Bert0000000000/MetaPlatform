package com.metaplatform.llmgw.models;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.llmgw.entity.ModelEntity;
import com.metaplatform.llmgw.models.dto.CreateModelRequest;
import com.metaplatform.llmgw.models.dto.ModelDto;
import com.metaplatform.llmgw.repository.ModelEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ModelService {

    private final ModelEntityRepository modelEntityRepository;
    private final ObjectMapper objectMapper;

    public ModelDto createModel(CreateModelRequest request) {
        ModelEntity entity = new ModelEntity();
        entity.setProvider(request.provider());
        entity.setModelId(request.modelId());
        entity.setDisplayName(request.displayName());
        entity.setModality(request.modality());
        entity.setContextWindow(request.contextWindow());
        entity.setMaxOutputTokens(request.maxOutputTokens());
        entity.setInputPricePer1k(request.inputPricePer1k());
        entity.setOutputPricePer1k(request.outputPricePer1k());
        entity.setIsActive(true);
        entity.setCapabilities(writeJson(request.capabilities()));
        ModelEntity saved = modelEntityRepository.save(entity);
        return toDto(saved);
    }

    public ModelDto getModel(Long id) {
        ModelEntity entity = modelEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + id));
        return toDto(entity);
    }

    public List<ModelDto> listModels(boolean activeOnly) {
        List<ModelEntity> entities = activeOnly
                ? modelEntityRepository.findByIsActiveTrue()
                : modelEntityRepository.findAll();
        return entities.stream().map(this::toDto).toList();
    }

    public ModelDto updateModel(Long id, CreateModelRequest request) {
        ModelEntity entity = modelEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + id));
        entity.setProvider(request.provider());
        entity.setModelId(request.modelId());
        entity.setDisplayName(request.displayName());
        entity.setModality(request.modality());
        entity.setContextWindow(request.contextWindow());
        entity.setMaxOutputTokens(request.maxOutputTokens());
        entity.setInputPricePer1k(request.inputPricePer1k());
        entity.setOutputPricePer1k(request.outputPricePer1k());
        entity.setCapabilities(writeJson(request.capabilities()));
        ModelEntity saved = modelEntityRepository.save(entity);
        return toDto(saved);
    }

    public void deleteModel(Long id) {
        modelEntityRepository.deleteById(id);
    }

    public int syncModels(List<CreateModelRequest> requests) {
        int count = 0;
        for (CreateModelRequest request : requests) {
            ModelEntity entity = modelEntityRepository
                    .findByProviderAndModelId(request.provider(), request.modelId())
                    .orElseGet(ModelEntity::new);
            entity.setProvider(request.provider());
            entity.setModelId(request.modelId());
            entity.setDisplayName(request.displayName());
            entity.setModality(request.modality());
            entity.setContextWindow(request.contextWindow());
            entity.setMaxOutputTokens(request.maxOutputTokens());
            entity.setInputPricePer1k(request.inputPricePer1k());
            entity.setOutputPricePer1k(request.outputPricePer1k());
            if (entity.getIsActive() == null) {
                entity.setIsActive(true);
            }
            entity.setCapabilities(writeJson(request.capabilities()));
            modelEntityRepository.save(entity);
            count++;
        }
        return count;
    }

    private ModelDto toDto(ModelEntity entity) {
        return new ModelDto(
                entity.getId(),
                entity.getProvider(),
                entity.getModelId(),
                entity.getDisplayName(),
                entity.getModality(),
                entity.getContextWindow(),
                entity.getMaxOutputTokens(),
                entity.getInputPricePer1k(),
                entity.getOutputPricePer1k(),
                entity.getIsActive(),
                readJson(entity.getCapabilities())
        );
    }

    private String writeJson(Map<String, Object> value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize capabilities", e);
        }
    }

    private Map<String, Object> readJson(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(value, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize capabilities", e);
        }
    }
}
