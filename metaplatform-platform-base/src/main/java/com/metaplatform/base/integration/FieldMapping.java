package com.metaplatform.base.integration;

import java.util.Collections;
import java.util.Map;

/**
 * 字段映射：外部系统字段名 -> 平台内部字段名。
 * 例如：{"external_name": "name", "ext_email": "email"}
 */
public record FieldMapping(Map<String, String> mappings) {

    public FieldMapping {
        if (mappings == null) {
            mappings = Collections.emptyMap();
        }
        mappings = Collections.unmodifiableMap(mappings);
    }

    public static FieldMapping of(Map<String, String> mappings) {
        return new FieldMapping(mappings);
    }

    public static FieldMapping empty() {
        return new FieldMapping(Map.of());
    }

    /**
     * 将外部字段名转换为内部字段名
     */
    public String toInternal(String externalField) {
        return mappings.getOrDefault(externalField, externalField);
    }

    /**
     * 将内部字段名转换为外部字段名
     */
    public String toExternal(String internalField) {
        return mappings.entrySet().stream()
                .filter(e -> e.getValue().equals(internalField))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(internalField);
    }

    /**
     * 转换整个数据 map（外部字段名 -> 内部字段名）
     */
    public Map<String, Object> transformInbound(Map<String, Object> externalData) {
        var result = new java.util.HashMap<String, Object>();
        externalData.forEach((key, value) -> {
            String internalKey = toInternal(key);
            result.put(internalKey, value);
        });
        return result;
    }

    /**
     * 转换整个数据 map（内部字段名 -> 外部字段名）
     */
    public Map<String, Object> transformOutbound(Map<String, Object> internalData) {
        var result = new java.util.HashMap<String, Object>();
        internalData.forEach((key, value) -> {
            String externalKey = toExternal(key);
            result.put(externalKey, value);
        });
        return result;
    }
}
