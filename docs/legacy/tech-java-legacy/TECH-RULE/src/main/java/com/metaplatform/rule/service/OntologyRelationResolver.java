package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * P1-RULE-04：Ontology 关系路径解析器。
 *
 * <p>在规则执行前，根据条件表达式中的关系路径（如 {@code customer.orders.totalAmount}）
 * 调用 TECH-ONT 接口解析相关实体属性，并将其注入到 SpEL 求值上下文中。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OntologyRelationResolver {

    private final WebClient ontologyWebClient;
    private final ObjectMapper objectMapper;

    private static final Pattern RELATION_PATH_PATTERN =
            Pattern.compile("\\b([a-zA-Z_][a-zA-Z0-9_]*)\\.([a-zA-Z_][a-zA-Z0-9_]*)(?:\\.([a-zA-Z_][a-zA-Z0-9_]*))?");

    private static final Set<String> SINGLE_CARDINALITIES = Set.of("ONE_TO_ONE", "MANY_TO_ONE");

    /**
     * 根据条件表达式中的关系路径，对输入数据进行增强。
     */
    public Map<String, Object> enrich(Map<String, Object> inputData, Collection<String> conditionExprs) {
        Map<String, Object> enriched = new HashMap<>(inputData);
        List<RelationPath> paths = parsePaths(conditionExprs);
        if (paths.isEmpty()) {
            return enriched;
        }

        Set<String> roots = paths.stream().map(RelationPath::root).collect(Collectors.toSet());
        for (String root : roots) {
            Object value = enriched.get(root);
            Map<String, Object> entityMap = toEntityMap(value);
            if (entityMap == null) {
                continue;
            }
            String entityId = (String) entityMap.get("entityId");
            if (entityId == null) {
                continue;
            }
            Map<String, Object> fullEntity = fetchEntity(entityId);
            if (fullEntity != null) {
                entityMap = new HashMap<>(fullEntity);
            }
            String conceptId = (String) entityMap.get("conceptId");

            for (RelationPath path : paths) {
                if (!path.root.equals(root)) {
                    continue;
                }
                Object resolved = resolvePath(entityId, conceptId, path);
                if (resolved != null) {
                    entityMap.put(path.relation, resolved);
                }
            }
            enriched.put(root, entityMap);
        }
        return enriched;
    }

    private List<RelationPath> parsePaths(Collection<String> conditionExprs) {
        List<RelationPath> paths = new ArrayList<>();
        if (conditionExprs == null) {
            return paths;
        }
        for (String expr : conditionExprs) {
            if (expr == null || expr.isBlank()) {
                continue;
            }
            Matcher matcher = RELATION_PATH_PATTERN.matcher(expr);
            while (matcher.find()) {
                String attribute = matcher.group(3);
                paths.add(new RelationPath(matcher.group(1), matcher.group(2), attribute));
            }
        }
        return paths;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toEntityMap(Object value) {
        if (value instanceof String entityId) {
            Map<String, Object> map = new HashMap<>();
            map.put("entityId", entityId);
            return map;
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new HashMap<>();
            map.forEach((k, v) -> result.put(String.valueOf(k), v));
            if (!result.containsKey("entityId") && result.containsKey("id")) {
                result.put("entityId", result.get("id"));
            }
            return result;
        }
        return null;
    }

    private Object resolvePath(String entityId, String conceptId, RelationPath path) {
        Map<String, Object> relationType = fetchRelationType(path.relation);
        if (relationType == null) {
            return null;
        }
        String sourceConceptId = (String) relationType.get("sourceConceptId");
        if (sourceConceptId != null && conceptId != null && !sourceConceptId.equals(conceptId)) {
            log.debug("Relation {} source concept {} does not match entity concept {}",
                    path.relation, sourceConceptId, conceptId);
            return null;
        }
        String relationTypeId = (String) relationType.get("relationTypeId");
        List<String> targetIds = fetchTargetEntityIds(entityId, relationTypeId);
        if (targetIds.isEmpty()) {
            return null;
        }

        List<Map<String, Object>> targets = targetIds.stream()
                .map(this::fetchEntity)
                .filter(Objects::nonNull)
                .toList();

        String cardinality = (String) relationType.get("cardinality");
        boolean single = cardinality != null && SINGLE_CARDINALITIES.contains(cardinality.toUpperCase());

        if (path.attribute == null) {
            return single && targets.size() == 1 ? targets.get(0) : targets;
        }

        List<Object> attributeValues = targets.stream()
                .map(t -> t.get(path.attribute))
                .filter(Objects::nonNull)
                .toList();
        if (single && attributeValues.size() == 1) {
            return attributeValues.get(0);
        }
        return attributeValues;
    }

    private List<String> fetchTargetEntityIds(String sourceEntityId, String relationTypeId) {
        try {
            String body = ontologyWebClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/ont/relations/instances")
                            .queryParam("sourceEntityId", sourceEntityId)
                            .queryParam("relationTypeId", relationTypeId)
                            .build())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            JsonNode data = readData(body);
            if (data == null || !data.has("items")) {
                return List.of();
            }
            List<String> ids = new ArrayList<>();
            for (JsonNode item : data.get("items")) {
                JsonNode targetId = item.get("targetEntityId");
                if (targetId != null && !targetId.isNull()) {
                    ids.add(targetId.asText());
                }
            }
            return ids;
        } catch (WebClientResponseException e) {
            log.warn("Failed to fetch relation instances: {}", e.getStatusCode());
            return List.of();
        } catch (Exception e) {
            log.warn("Failed to resolve relation instances: {}", e.getMessage());
            return List.of();
        }
    }

    private Map<String, Object> fetchRelationType(String code) {
        try {
            String body = ontologyWebClient.get()
                    .uri("/api/v1/ont/relations/types/by-code/{code}", code)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            JsonNode data = readData(body);
            return data != null ? toMap(data) : null;
        } catch (WebClientResponseException e) {
            log.warn("Relation type {} not found: {}", code, e.getStatusCode());
            return null;
        } catch (Exception e) {
            log.warn("Failed to fetch relation type {}: {}", code, e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchEntity(String entityId) {
        try {
            String body = ontologyWebClient.get()
                    .uri("/api/v1/ont/entities/{id}", entityId)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            JsonNode data = readData(body);
            if (data == null) {
                return null;
            }
            Map<String, Object> entity = toMap(data);
            if (entity.containsKey("attributes")) {
                Map<String, Object> attributes = (Map<String, Object>) entity.get("attributes");
                Map<String, Object> flattened = new HashMap<>();
                attributes.forEach((code, wrapper) -> {
                    if (wrapper instanceof Map<?, ?> map && map.containsKey("value")) {
                        flattened.put(code, map.get("value"));
                    } else {
                        flattened.put(code, wrapper);
                    }
                });
                entity.putAll(flattened);
            }
            return entity;
        } catch (WebClientResponseException e) {
            log.warn("Entity {} not found: {}", entityId, e.getStatusCode());
            return null;
        } catch (Exception e) {
            log.warn("Failed to fetch entity {}: {}", entityId, e.getMessage());
            return null;
        }
    }

    private JsonNode readData(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(body);
            return root.has("data") ? root.get("data") : root;
        } catch (Exception e) {
            log.warn("Failed to parse ONT response: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(JsonNode node) {
        return objectMapper.convertValue(node, Map.class);
    }

    private record RelationPath(String root, String relation, String attribute) {
    }
}
