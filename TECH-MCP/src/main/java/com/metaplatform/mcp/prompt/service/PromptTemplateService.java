package com.metaplatform.mcp.prompt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.prompt.dto.CreatePromptTemplateRequest;
import com.metaplatform.mcp.prompt.dto.PromptTemplateResponse;
import com.metaplatform.mcp.prompt.dto.UpdatePromptTemplateRequest;
import com.metaplatform.mcp.prompt.entity.McpPromptTemplateEntity;
import com.metaplatform.mcp.prompt.repository.McpPromptTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class PromptTemplateService {

    private static final String DEFAULT_STATUS = "ACTIVE";
    private static final Pattern VAR_PATTERN = Pattern.compile("\\{\\{\\s*([\\w.]+)\\s*\\}\\}");

    private final McpPromptTemplateRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public PromptTemplateResponse create(CreatePromptTemplateRequest request) {
        String tenantId = TenantContext.getOrDefault();
        validateJson(request.getVariables(), "variables");

        Instant now = Instant.now();
        McpPromptTemplateEntity entity = McpPromptTemplateEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .description(request.getDescription())
                .template(request.getTemplate())
                .variables(normalizeJson(request.getVariables(), "[]"))
                .version(1)
                .status(DEFAULT_STATUS)
                .category(request.getCategory())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public PageResponse<PromptTemplateResponse> list(String status, String category,
                                                     String keyword, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));

        List<McpPromptTemplateEntity> all = repository.search(
                tenantId,
                status == null ? null : status.toUpperCase(),
                category, keyword);

        int start = (int) pageable.getOffset();
        int end = Math.min(start + s, all.size());
        List<PromptTemplateResponse> items = (start <= all.size())
                ? all.subList(start, end).stream().map(this::toResponse).toList()
                : List.of();

        return PageResponse.<PromptTemplateResponse>builder()
                .items(items)
                .total(all.size())
                .page(p)
                .size(s)
                .totalPages(all.isEmpty() ? 0 : (int) Math.ceil((double) all.size() / s))
                .build();
    }

    @Transactional(readOnly = true)
    public PromptTemplateResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public PromptTemplateResponse update(UUID id, UpdatePromptTemplateRequest request) {
        McpPromptTemplateEntity entity = findById(id);
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getTemplate() != null) {
            entity.setTemplate(request.getTemplate());
            entity.setVersion(entity.getVersion() + 1);
        }
        if (request.getVariables() != null) {
            validateJson(request.getVariables(), "variables");
            entity.setVariables(request.getVariables());
        }
        if (request.getStatus() != null) {
            entity.setStatus(request.getStatus().toUpperCase());
        }
        if (request.getCategory() != null) {
            entity.setCategory(request.getCategory());
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        McpPromptTemplateEntity entity = findById(id);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        repository.save(entity);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> render(UUID id, Map<String, Object> variables) {
        McpPromptTemplateEntity entity = findById(id);
        String rendered = renderTemplate(entity.getTemplate(), variables);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", entity.getId());
        result.put("rendered", rendered);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> preview(UUID id) {
        McpPromptTemplateEntity entity = findById(id);
        Map<String, Object> sampleVars = extractSampleVariables(entity.getTemplate());
        String rendered = renderTemplate(entity.getTemplate(), sampleVars);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", entity.getId());
        result.put("rendered", rendered);
        result.put("sampleVariables", sampleVars);
        return result;
    }

    private Map<String, Object> extractSampleVariables(String template) {
        Map<String, Object> samples = new LinkedHashMap<>();
        Matcher matcher = VAR_PATTERN.matcher(template);
        while (matcher.find()) {
            String name = matcher.group(1);
            samples.putIfAbsent(name, "[" + name + "]");
        }
        return samples;
    }

    String renderTemplate(String template, Map<String, Object> variables) {
        if (template == null) {
            return "";
        }
        Map<String, Object> safeVars = variables == null ? new HashMap<>() : variables;
        Matcher matcher = VAR_PATTERN.matcher(template);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String name = matcher.group(1);
            Object value = safeVars.get(name);
            String replacement = value == null ? "" : Matcher.quoteReplacement(value.toString());
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    McpPromptTemplateEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new McpException(ErrorCode.PROMPT_TEMPLATE_NOT_FOUND, "Prompt 模板不存在"));
    }

    private PromptTemplateResponse toResponse(McpPromptTemplateEntity entity) {
        return PromptTemplateResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .template(entity.getTemplate())
                .variables(entity.getVariables())
                .version(entity.getVersion())
                .status(entity.getStatus())
                .category(entity.getCategory())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new McpException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}