package com.metaplatform.llmgw.prompts.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.llmgw.entity.PromptEntity;
import com.metaplatform.llmgw.entity.PromptVersionEntity;
import com.metaplatform.llmgw.prompts.dto.CreatePromptRequest;
import com.metaplatform.llmgw.prompts.dto.PromptDto;
import com.metaplatform.llmgw.repository.PromptEntityRepository;
import com.metaplatform.llmgw.repository.PromptVersionEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class PromptService {

    private final PromptEntityRepository promptEntityRepository;
    private final PromptVersionEntityRepository promptVersionEntityRepository;
    private final ObjectMapper objectMapper;

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{\\s*(.*?)\\s*\\}\\}");

    @Transactional
    public PromptDto createPrompt(CreatePromptRequest request, String createdBy) {
        PromptEntity entity = new PromptEntity();
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setCategory(request.category());
        entity.setTemplateText(request.templateText());
        entity.setVariables(writeJson(request.variables()));
        entity.setVersion(1);
        entity.setIsActive(true);
        entity.setCreatedBy(createdBy);
        PromptEntity saved = promptEntityRepository.save(entity);
        createVersion(saved, createdBy);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public PromptDto getPrompt(Long id) {
        PromptEntity entity = promptEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Prompt not found: " + id));
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public List<PromptDto> listPrompts(String category, Boolean activeOnly) {
        List<PromptEntity> entities;
        if (category != null && !category.isBlank()) {
            entities = promptEntityRepository.findByCategory(category);
        } else {
            entities = promptEntityRepository.findAll();
        }
        return entities.stream()
                .filter(e -> !Boolean.TRUE.equals(activeOnly) || Boolean.TRUE.equals(e.getIsActive()))
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public PromptDto updatePrompt(Long id, CreatePromptRequest request) {
        PromptEntity entity = promptEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Prompt not found: " + id));
        String newTemplateText = request.templateText() == null ? entity.getTemplateText() : request.templateText();
        Map<String, Object> newVariables = request.variables() == null ? readJson(entity.getVariables()) : request.variables();
        boolean changed = !Objects.equals(entity.getTemplateText(), newTemplateText)
                || !Objects.equals(readJson(entity.getVariables()), newVariables);
        entity.setName(request.name() == null ? entity.getName() : request.name());
        entity.setDescription(request.description() == null ? entity.getDescription() : request.description());
        entity.setCategory(request.category() == null ? entity.getCategory() : request.category());
        if (changed) {
            entity.setTemplateText(newTemplateText);
            entity.setVariables(writeJson(newVariables));
            entity.setVersion(entity.getVersion() + 1);
            PromptEntity saved = promptEntityRepository.save(entity);
            createVersion(saved, entity.getCreatedBy());
            return toDto(saved);
        }
        PromptEntity saved = promptEntityRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void deletePrompt(Long id) {
        promptEntityRepository.deleteById(id);
    }

    @Transactional
    public PromptDto rollbackPrompt(Long id, Integer version) {
        PromptEntity entity = promptEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Prompt not found: " + id));
        PromptVersionEntity versionEntity = promptVersionEntityRepository.findByPromptIdAndVersion(id, version)
                .orElseThrow(() -> new IllegalArgumentException("Prompt version not found: " + id + "@" + version));
        entity.setTemplateText(versionEntity.getTemplateText());
        entity.setVariables(versionEntity.getVariables());
        entity.setVersion(entity.getVersion() + 1);
        PromptEntity saved = promptEntityRepository.save(entity);
        createVersion(saved, versionEntity.getCreatedBy());
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public String renderPrompt(Long id, Map<String, Object> variables) {
        PromptEntity entity = promptEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Prompt not found: " + id));
        Map<String, Object> merged = new HashMap<>();
        Map<String, Object> defaults = readJson(entity.getVariables());
        if (defaults != null) {
            merged.putAll(defaults);
        }
        if (variables != null) {
            merged.putAll(variables);
        }
        return renderTemplate(entity.getTemplateText(), merged);
    }

    public String renderTemplate(String templateText, Map<String, Object> variables) {
        if (templateText == null) {
            return null;
        }
        Matcher matcher = VARIABLE_PATTERN.matcher(templateText);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String key = matcher.group(1);
            Object value = resolveVariable(variables, key);
            matcher.appendReplacement(sb, value == null ? "" : Matcher.quoteReplacement(value.toString()));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private void createVersion(PromptEntity prompt, String createdBy) {
        PromptVersionEntity version = new PromptVersionEntity();
        version.setPromptId(prompt.getId());
        version.setVersion(prompt.getVersion());
        version.setTemplateText(prompt.getTemplateText());
        version.setVariables(prompt.getVariables());
        version.setCreatedBy(createdBy);
        promptVersionEntityRepository.save(version);
    }

    private Object resolveVariable(Map<String, Object> variables, String key) {
        if (variables == null || key == null) {
            return null;
        }
        if (key.contains(".")) {
            String[] parts = key.split("\\.", 2);
            Object next = variables.get(parts[0]);
            if (next instanceof Map<?, ?> map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> nested = (Map<String, Object>) map;
                return resolveVariable(nested, parts[1]);
            }
            return null;
        }
        return variables.get(key);
    }

    private PromptDto toDto(PromptEntity entity) {
        return new PromptDto(
                entity.getId(),
                entity.getName(),
                entity.getDescription(),
                entity.getCategory(),
                entity.getTemplateText(),
                readJson(entity.getVariables()),
                entity.getVersion(),
                entity.getIsActive(),
                entity.getCreatedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private String writeJson(Map<String, Object> value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to serialize variables", e);
        }
    }

    private Map<String, Object> readJson(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(value, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize variables", e);
        }
    }
}
