package com.metaplatform.appservice.domain.form;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * v1.0.2 Sprint 2 F1.4: 解析表单 schemaJson, 抽取所有 lookup 字段.
 *
 * <p>输入: 表单 schema (sections[].fields[]), 字段形如:
 * <pre>
 * { "field": "customer_id", "widget": "lookup",
 *   "lookup": { "objectId": "5", "displayField": "name" } }
 * </pre>
 *
 * <p>输出: [{field, objectId, displayField}, ...]
 *
 * <p>支持两种 lookup 配置格式:
 * <ul>
 *   <li>嵌套:  field.lookup.{objectId, displayField}  (object-style schema)</li>
 *   <li>扁平:  field.boundObject/boundProperty         (low-code designer 输出)</li>
 * </ul>
 */
public final class LookupFieldExtractor {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private LookupFieldExtractor() {}

    public static Map<String, Object> parseSchema(String schemaJson) {
        if (schemaJson == null || schemaJson.isBlank()) return Map.of();
        try {
            return MAPPER.readValue(schemaJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, String>> extract(Map<String, Object> schema) {
        List<Map<String, String>> result = new ArrayList<>();
        if (schema == null) return result;
        Object sectionsObj = schema.get("sections");
        if (!(sectionsObj instanceof List)) return result;
        List<Object> sections = (List<Object>) sectionsObj;
        for (Object secObj : sections) {
            if (!(secObj instanceof Map)) continue;
            Map<String, Object> section = (Map<String, Object>) secObj;
            Object fieldsObj = section.get("fields");
            if (!(fieldsObj instanceof List)) continue;
            List<Object> fields = (List<Object>) fieldsObj;
            for (Object fObj : fields) {
                if (!(fObj instanceof Map)) continue;
                Map<String, String> entry = extractOne((Map<String, Object>) fObj);
                if (entry != null) result.add(entry);
            }
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> extractOne(Map<String, Object> field) {
        if (field == null) return null;
        String type = String.valueOf(field.getOrDefault("widget",
                field.getOrDefault("type", "")));
        if (!"lookup".equalsIgnoreCase(type)) return null;

        Map<String, String> entry = new LinkedHashMap<>();
        entry.put("field", String.valueOf(
                field.getOrDefault("field",
                        field.getOrDefault("key",
                                field.getOrDefault("name", "")))));
        Object lookupObj = field.get("lookup");
        if (lookupObj instanceof Map) {
            Map<String, Object> lookup = (Map<String, Object>) lookupObj;
            entry.put("objectId", String.valueOf(lookup.getOrDefault("objectId", "")));
            entry.put("displayField", String.valueOf(lookup.getOrDefault("displayField", "")));
        } else {
            // fallback: low-code designer puts boundObject/boundProperty at field top level
            entry.put("objectId", String.valueOf(field.getOrDefault("boundObject", "")));
            entry.put("displayField", String.valueOf(field.getOrDefault("boundProperty", "")));
        }
        if (entry.get("objectId").isEmpty() || entry.get("displayField").isEmpty()) {
            return null;
        }
        return entry;
    }

    /** 校验 SQL identifier 防注入: 字母开头 + 字母数字下划线 */
    public static boolean isValidIdentifier(String s) {
        if (s == null || s.isBlank()) return false;
        return s.matches("^[a-z][a-z0-9_]{0,62}$");
    }
}