package com.metaplatform.rag.knowledge.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rag.entity.KnowledgeBaseEntity;
import com.metaplatform.rag.knowledge.dto.CreateKnowledgeBaseRequest;
import com.metaplatform.rag.knowledge.dto.KnowledgeBaseDto;
import com.metaplatform.rag.knowledge.dto.RetrievalConfigDto;
import com.metaplatform.rag.repository.KnowledgeBaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KnowledgeBaseService {

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public KnowledgeBaseDto create(CreateKnowledgeBaseRequest request, String createdBy) {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setName(request.name());
        entity.setDescription(request.description());
        if (request.embeddingModel() != null) {
            entity.setEmbeddingModel(request.embeddingModel());
        }
        if (request.retrievalConfig() != null) {
            entity.setRetrievalConfig(toJson(request.retrievalConfig()));
        }
        entity.setCreatedBy(createdBy);
        KnowledgeBaseEntity saved = knowledgeBaseRepository.save(entity);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public KnowledgeBaseDto getById(UUID id) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Knowledge base not found: " + id));
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public List<KnowledgeBaseDto> listAll() {
        return knowledgeBaseRepository.findAllByIsActiveTrue().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public KnowledgeBaseDto update(UUID id, CreateKnowledgeBaseRequest request) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Knowledge base not found: " + id));
        entity.setName(request.name());
        entity.setDescription(request.description());
        if (request.embeddingModel() != null) {
            entity.setEmbeddingModel(request.embeddingModel());
        }
        if (request.retrievalConfig() != null) {
            entity.setRetrievalConfig(toJson(request.retrievalConfig()));
        }
        KnowledgeBaseEntity saved = knowledgeBaseRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void delete(UUID id) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Knowledge base not found: " + id));
        entity.setIsActive(false);
        knowledgeBaseRepository.save(entity);
    }

    @Transactional
    public KnowledgeBaseDto updateRetrievalConfig(UUID kbId, RetrievalConfigDto config) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findById(kbId)
            .orElseThrow(() -> new IllegalArgumentException("Knowledge base not found: " + kbId));
        entity.setRetrievalConfig(toJson(config));
        KnowledgeBaseEntity saved = knowledgeBaseRepository.save(entity);
        return toDto(saved);
    }

    private KnowledgeBaseDto toDto(KnowledgeBaseEntity entity) {
        RetrievalConfigDto config = null;
        try {
            config = objectMapper.readValue(entity.getRetrievalConfig(), RetrievalConfigDto.class);
        } catch (JsonProcessingException ignored) {
        }
        return new KnowledgeBaseDto(
            entity.getId(),
            entity.getName(),
            entity.getDescription(),
            entity.getEmbeddingModel(),
            config,
            entity.getIsActive(),
            entity.getCreatedBy(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize config", e);
        }
    }
}
