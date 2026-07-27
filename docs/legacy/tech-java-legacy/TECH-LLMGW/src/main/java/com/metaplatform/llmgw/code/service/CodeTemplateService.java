package com.metaplatform.llmgw.code.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.llmgw.code.dto.CodeTemplateDto;
import com.metaplatform.llmgw.code.dto.CreateCodeTemplateRequest;
import com.metaplatform.llmgw.entity.CodeTemplateEntity;
import com.metaplatform.llmgw.repository.CodeTemplateEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CodeTemplateService {

    private final CodeTemplateEntityRepository codeTemplateEntityRepository;
    private final ObjectMapper objectMapper;

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\$\\{([^}]+)\\}");

    @Transactional(readOnly = true)
    public List<CodeTemplateDto> listAll() {
        return codeTemplateEntityRepository.findAll().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public CodeTemplateDto getById(Long id) {
        CodeTemplateEntity entity = codeTemplateEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Code template not found: " + id));
        return toDto(entity);
    }

    @Transactional
    public CodeTemplateDto create(CreateCodeTemplateRequest request) {
        CodeTemplateEntity entity = new CodeTemplateEntity();
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setLanguage(request.language());
        entity.setTemplateText(request.templateText());
        entity.setVariables(toJson(request.variables()));
        entity.setIsActive(request.isActive() == null ? Boolean.TRUE : request.isActive());
        CodeTemplateEntity saved = codeTemplateEntityRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public CodeTemplateDto update(Long id, CreateCodeTemplateRequest request) {
        CodeTemplateEntity entity = codeTemplateEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Code template not found: " + id));
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setLanguage(request.language());
        entity.setTemplateText(request.templateText());
        entity.setVariables(toJson(request.variables()));
        entity.setIsActive(request.isActive() == null ? entity.getIsActive() : request.isActive());
        CodeTemplateEntity saved = codeTemplateEntityRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        codeTemplateEntityRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public String render(Long id, Map<String, Object> variables) {
        CodeTemplateEntity entity = codeTemplateEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Code template not found: " + id));
        String templateText = entity.getTemplateText();
        if (templateText == null) {
            return "";
        }
        Map<String, Object> merged = mergeVariables(entity.getVariables(), variables);
        Matcher matcher = VARIABLE_PATTERN.matcher(templateText);
        StringBuffer result = new StringBuffer();
        while (matcher.find()) {
            String key = matcher.group(1);
            Object value = merged.get(key);
            if (value == null) {
                throw new IllegalArgumentException("Missing template variable: " + key);
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(value.toString()));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private Map<String, Object> mergeVariables(String storedVariables, Map<String, Object> requestVariables) {
        Map<String, Object> merged = parseVariables(storedVariables);
        if (requestVariables != null) {
            merged.putAll(requestVariables);
        }
        return merged;
    }

    private Map<String, Object> parseVariables(String variables) {
        if (variables == null || variables.isBlank()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(variables, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse template variables", e);
        }
    }

    private String toJson(Map<String, Object> variables) {
        if (variables == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(variables);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize template variables", e);
        }
    }

    private CodeTemplateDto toDto(CodeTemplateEntity entity) {
        return new CodeTemplateDto(
                entity.getId(),
                entity.getName(),
                entity.getDescription(),
                entity.getLanguage(),
                entity.getTemplateText(),
                parseVariables(entity.getVariables()),
                entity.getIsActive(),
                entity.getCreatedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
