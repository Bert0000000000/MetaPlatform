package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.CypherExecuteRequest;
import com.metaplatform.ont.dto.CypherExecuteResponse;
import com.metaplatform.ont.dto.CypherTemplateCreateRequest;
import com.metaplatform.ont.dto.CypherTemplateResponse;
import com.metaplatform.ont.entity.CypherTemplateEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.CypherTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

/**
 * Cypher 查询控制台服务（V12-05 REQ-062~063）。
 * <p>
 * 安全约束：仅允许 READ 类 Cypher 语句（MATCH / OPTIONAL MATCH / RETURN / WITH / UNWIND / ORDER BY / SKIP / LIMIT / WHERE / DISTINCT / 聚合函数）。
 * 任何写操作（CREATE / MERGE / SET / DELETE / REMOVE / DROP / INDEX / CONSTRAINT / FOREACH / LOAD CSV / CALL {...} IN TRANSACTIONS / PERIODIC 等）一律拒绝。
 * 多语句（;分隔）一律拒绝。
 * <p>
 * 模板分类：concept / relation / path / aggregate。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CypherConsoleService {

    private static final int MAX_ROWS = 1000;

    /**
     * 禁止关键字（无论位置）。
     * 一旦匹配则判定为非只读查询。
     */
    private static final List<Pattern> FORBIDDEN_PATTERNS = List.of(
            wordPattern("CREATE"),
            wordPattern("MERGE"),
            wordPattern("DELETE"),
            wordPattern("DETACH"),
            wordPattern("SET"),     // SET 用于属性更新
            wordPattern("REMOVE"),
            wordPattern("DROP"),
            wordPattern("INDEX"),
            wordPattern("CONSTRAINT"),
            wordPattern("FOREACH"),
            wordPattern("CALL"),
            wordPattern("YIELD"),
            wordPattern("LOAD\\s+CSV"),
            wordPattern("PERIODIC"),
            wordPattern("BEGIN"),
            wordPattern("COMMIT"),
            wordPattern("START")
    );

    private final Neo4jClient neo4jClient;
    private final CypherTemplateRepository cypherTemplateRepository;
    private final ObjectMapper objectMapper;

    // =================================================================
    // REQ-062: 执行 Cypher 查询
    // =================================================================

    public CypherExecuteResponse execute(CypherExecuteRequest request) {
        String cypher = sanitizeAndValidate(request.getQuery());
        Map<String, Object> params = request.getParams() == null
                ? new HashMap<>()
                : new HashMap<>(request.getParams());
        int limit = request.getLimit() == null ? 100 : Math.max(1, Math.min(MAX_ROWS, request.getLimit()));

        // 服务端强制 LIMIT
        String boundedCypher = ensureLimit(cypher, limit);

        long started = System.currentTimeMillis();
        Collection<Map<String, Object>> records;
        try {
            records = executeCypherQuery(boundedCypher, params);
        } catch (Exception e) {
            log.warn("Cypher query execution failed: traceId={}, error={}", com.metaplatform.ont.common.TraceContext.getOrCreate(), e.getMessage());
            throw new OntException(ErrorCode.NEO4J_ERROR, "Cypher 查询执行失败：" + e.getMessage());
        }
        long durationMs = System.currentTimeMillis() - started;

        List<String> columns = new ArrayList<>();
        Set<String> seenColumns = new LinkedHashSet<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        int rowCounter = 0;
        for (Map<String, Object> record : records) {
            if (rowCounter >= limit) {
                break;
            }
            // LinkedHashSet 保留首次出现的顺序
            for (String key : record.keySet()) {
                seenColumns.add(key);
            }
            rows.add(new LinkedHashMap<>(record));
            rowCounter++;
        }
        columns.addAll(seenColumns);

        return CypherExecuteResponse.builder()
                .columns(columns)
                .rows(rows)
                .rowCount(rows.size())
                .durationMs(durationMs)
                .build();
    }

    /**
     * 实际执行 Cypher 查询。提取为 protected 方法便于单元测试 spy 覆盖。
     */
    protected Collection<Map<String, Object>> executeCypherQuery(String cypher, Map<String, Object> params) {
        return neo4jClient.query(cypher).bindAll(params).fetch().all();
    }

    /**
     * 校验 Cypher 语句为只读。
     * 拒绝：空语句、多语句、注释外的禁止关键字。
     */
    String sanitizeAndValidate(String raw) {
        if (!StringUtils.hasText(raw)) {
            throw new OntException(ErrorCode.CYPHER_QUERY_INVALID, "Cypher 查询语句为空");
        }
        // 去除字符串字面量与注释后再做关键字检测，避免误伤
        String stripped = stripLiteralsAndComments(raw);
        if (stripped.isBlank()) {
            throw new OntException(ErrorCode.CYPHER_QUERY_INVALID, "Cypher 语句不合法");
        }
        if (stripped.indexOf(';') >= 0) {
            // 简化策略：禁止多语句（语句中含 ;）
            throw new OntException(ErrorCode.CYPHER_QUERY_INVALID, "Cypher 一次只能执行一条语句");
        }
        for (Pattern p : FORBIDDEN_PATTERNS) {
            Matcher m = p.matcher(stripped);
            if (m.find()) {
                throw new OntException(ErrorCode.CYPHER_WRITE_FORBIDDEN,
                        "Cypher 查询包含禁止的关键字：" + m.group().trim());
            }
        }
        // 必须以 MATCH / OPTIONAL MATCH / RETURN / WITH 起始（去前导空白后）
        String trimmedUpper = stripped.stripLeading().toUpperCase();
        if (!(trimmedUpper.startsWith("MATCH")
                || trimmedUpper.startsWith("OPTIONAL MATCH")
                || trimmedUpper.startsWith("RETURN")
                || trimmedUpper.startsWith("WITH"))) {
            throw new OntException(ErrorCode.CYPHER_QUERY_INVALID,
                    "Cypher 查询必须以 MATCH / OPTIONAL MATCH / WITH / RETURN 起始");
        }
        return raw.strip();
    }

    /**
     * 去除字符串字面量（单/双引号）与注释（// 行注释与 /* 块注释 *​/）。
     * 使用状态机扫描，避免正则回溯。
     */
    String stripLiteralsAndComments(String input) {
        StringBuilder sb = new StringBuilder(input.length());
        int i = 0;
        int n = input.length();
        char quote = 0;
        while (i < n) {
            char c = input.charAt(i);
            if (quote != 0) {
                if (c == '\\') {
                    i += 2;
                    continue;
                }
                if (c == quote) {
                    quote = 0;
                }
                i++;
                continue;
            }
            if (c == '\'' || c == '"') {
                quote = c;
                i++;
                continue;
            }
            if (c == '/' && i + 1 < n && input.charAt(i + 1) == '/') {
                while (i < n && input.charAt(i) != '\n') {
                    i++;
                }
                continue;
            }
            if (c == '/' && i + 1 < n && input.charAt(i + 1) == '*') {
                i += 2;
                while (i + 1 < n && !(input.charAt(i) == '*' && input.charAt(i + 1) == '/')) {
                    i++;
                }
                i += 2;
                continue;
            }
            sb.append(c);
            i++;
        }
        return sb.toString();
    }

    /**
     * 服务端强制 LIMIT。
     * 仅当语句本身未声明 LIMIT 时追加 LIMIT n。
     * 通过检测 stripped 末尾的 "limit \d+" 来判定。
     */
    String ensureLimit(String cypher, int limit) {
        String stripped = stripLiteralsAndComments(cypher).stripTrailing();
        Pattern trailingLimit = Pattern.compile("(?i)\\bLIMIT\\s+\\d+\\s*$");
        if (trailingLimit.matcher(stripped).find()) {
            return cypher;
        }
        return cypher.stripTrailing() + "\nLIMIT " + limit;
    }

    private static Pattern wordPattern(String word) {
        return Pattern.compile("(?i)\\b" + word + "\\b");
    }

    // =================================================================
    // REQ-063: 模板 CRUD + 分类列表
    // =================================================================

    @Transactional(readOnly = true)
    public List<CypherTemplateResponse> listTemplates(String category, String keyword) {
        String tenantId = TenantContext.get();
        List<CypherTemplateEntity> entities;
        if (StringUtils.hasText(category)) {
            entities = cypherTemplateRepository.findByTenantIdAndCategoryOrderByUpdatedAtDesc(tenantId, category);
        } else {
            entities = cypherTemplateRepository.findByTenantIdOrderByUpdatedAtDesc(tenantId);
        }
        return entities.stream()
                .filter(t -> matchesKeyword(t, keyword))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CypherTemplateResponse getTemplate(String templateId) {
        String tenantId = TenantContext.get();
        CypherTemplateEntity entity = cypherTemplateRepository.findByTemplateIdAndTenantId(templateId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.CYPHER_TEMPLATE_NOT_FOUND));
        return toResponse(entity);
    }

    @Transactional
    public CypherTemplateResponse createTemplate(CypherTemplateCreateRequest request) {
        String tenantId = TenantContext.get();
        if (cypherTemplateRepository.existsByTenantIdAndName(tenantId, request.getName())) {
            throw new OntException(ErrorCode.CYPHER_TEMPLATE_ALREADY_EXISTS, "模板名称已存在");
        }
        // 校验查询合法性（不执行）
        sanitizeAndValidate(request.getQuery());

        CypherTemplateEntity entity = CypherTemplateEntity.builder()
                .templateId(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .name(request.getName())
                .category(request.getCategory())
                .description(request.getDescription())
                .query(request.getQuery())
                .tags(toJsonNode(request.getTags()))
                .builtin(false)
                .createdBy(TenantContext.getUserId())
                .updatedBy(TenantContext.getUserId())
                .build();
        CypherTemplateEntity saved = cypherTemplateRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public CypherTemplateResponse updateTemplate(String templateId, CypherTemplateCreateRequest request) {
        String tenantId = TenantContext.get();
        CypherTemplateEntity entity = cypherTemplateRepository.findByTemplateIdAndTenantId(templateId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.CYPHER_TEMPLATE_NOT_FOUND));
        if (Boolean.TRUE.equals(entity.getBuiltin())) {
            throw new OntException(ErrorCode.PERMISSION_DENIED, "内置模板不可修改");
        }
        if (cypherTemplateRepository.existsByTenantIdAndNameAndTemplateIdNot(tenantId, request.getName(), templateId)) {
            throw new OntException(ErrorCode.CYPHER_TEMPLATE_ALREADY_EXISTS, "模板名称已存在");
        }
        sanitizeAndValidate(request.getQuery());

        entity.setName(request.getName());
        entity.setCategory(request.getCategory());
        entity.setDescription(request.getDescription());
        entity.setQuery(request.getQuery());
        entity.setTags(toJsonNode(request.getTags()));
        entity.setUpdatedBy(TenantContext.getUserId());
        CypherTemplateEntity saved = cypherTemplateRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void deleteTemplate(String templateId) {
        String tenantId = TenantContext.get();
        CypherTemplateEntity entity = cypherTemplateRepository.findByTemplateIdAndTenantId(templateId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.CYPHER_TEMPLATE_NOT_FOUND));
        if (Boolean.TRUE.equals(entity.getBuiltin())) {
            throw new OntException(ErrorCode.PERMISSION_DENIED, "内置模板不可删除");
        }
        cypherTemplateRepository.delete(entity);
    }

    /**
     * 分类列表（去重）。
     */
    @Transactional(readOnly = true)
    public List<String> listCategories() {
        String tenantId = TenantContext.get();
        return cypherTemplateRepository.findByTenantIdOrderByUpdatedAtDesc(tenantId).stream()
                .map(CypherTemplateEntity::getCategory)
                .filter(StringUtils::hasText)
                .distinct()
                .sorted()
                .toList();
    }

    private boolean matchesKeyword(CypherTemplateEntity entity, String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return true;
        }
        String kw = keyword.toLowerCase();
        if (entity.getName() != null && entity.getName().toLowerCase().contains(kw)) {
            return true;
        }
        if (entity.getDescription() != null && entity.getDescription().toLowerCase().contains(kw)) {
            return true;
        }
        if (entity.getQuery() != null && entity.getQuery().toLowerCase().contains(kw)) {
            return true;
        }
        if (entity.getTags() != null && entity.getTags().isArray()) {
            for (JsonNode tag : entity.getTags()) {
                if (tag.isTextual() && tag.asText().toLowerCase().contains(kw)) {
                    return true;
                }
            }
        }
        return false;
    }

    private CypherTemplateResponse toResponse(CypherTemplateEntity entity) {
        return CypherTemplateResponse.builder()
                .templateId(entity.getTemplateId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .category(entity.getCategory())
                .description(entity.getDescription())
                .query(entity.getQuery())
                .tags(toStringList(entity.getTags()))
                .builtin(entity.getBuiltin())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .build();
    }

    private JsonNode toJsonNode(List<String> tags) {
        if (CollectionUtils.isEmpty(tags)) {
            return null;
        }
        return objectMapper.valueToTree(tags);
    }

    private List<String> toStringList(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        return StreamSupport.stream(node.spliterator(), false)
                .filter(JsonNode::isTextual)
                .map(JsonNode::asText)
                .collect(Collectors.toList());
    }
}
