package com.metaplatform.llmgw.code.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.llmgw.code.dto.CodeSnippetDto;
import com.metaplatform.llmgw.code.dto.CreateCodeSnippetRequest;
import com.metaplatform.llmgw.entity.CodeSnippetEntity;
import com.metaplatform.llmgw.repository.CodeSnippetEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CodeSnippetService {

    private final CodeSnippetEntityRepository codeSnippetEntityRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<CodeSnippetDto> listAll() {
        return codeSnippetEntityRepository.findAll().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<CodeSnippetDto> listByLanguage(String language) {
        return codeSnippetEntityRepository.findByLanguage(language).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public CodeSnippetDto getById(Long id) {
        CodeSnippetEntity entity = codeSnippetEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Code snippet not found: " + id));
        return toDto(entity);
    }

    @Transactional
    public CodeSnippetDto create(CreateCodeSnippetRequest request) {
        CodeSnippetEntity entity = new CodeSnippetEntity();
        entity.setTemplateId(request.templateId());
        entity.setTitle(request.title());
        entity.setLanguage(request.language());
        entity.setCodeText(request.codeText());
        entity.setDescription(request.description());
        entity.setTags(toJson(request.tags()));
        entity.setVersion(request.version() == null ? 1 : request.version());
        CodeSnippetEntity saved = codeSnippetEntityRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public CodeSnippetDto update(Long id, CreateCodeSnippetRequest request) {
        CodeSnippetEntity entity = codeSnippetEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Code snippet not found: " + id));
        entity.setTemplateId(request.templateId());
        entity.setTitle(request.title());
        entity.setLanguage(request.language());
        entity.setCodeText(request.codeText());
        entity.setDescription(request.description());
        entity.setTags(toJson(request.tags()));
        entity.setVersion(request.version() == null ? entity.getVersion() : request.version());
        CodeSnippetEntity saved = codeSnippetEntityRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        codeSnippetEntityRepository.deleteById(id);
    }

    private List<String> parseTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(tags, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse snippet tags", e);
        }
    }

    private String toJson(List<String> tags) {
        if (tags == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(tags);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize snippet tags", e);
        }
    }

    private CodeSnippetDto toDto(CodeSnippetEntity entity) {
        return new CodeSnippetDto(
                entity.getId(),
                entity.getTemplateId(),
                entity.getTitle(),
                entity.getLanguage(),
                entity.getCodeText(),
                entity.getDescription(),
                parseTags(entity.getTags()),
                entity.getVersion(),
                entity.getCreatedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
