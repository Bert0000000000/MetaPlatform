package com.metaplatform.ragmdm.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import java.util.List;
import java.util.Map;

public final class JsonUtils {

    private static final ObjectMapper MAPPER = new ObjectMapper()
        .registerModule(new JavaTimeModule());

    private JsonUtils() {}

    public static String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("JSON serialization failed", e);
        }
    }

    @SuppressWarnings("unchecked")
    public static <T> T fromJson(String json, Class<T> clazz) {
        if (json == null || json.isBlank()) return null;
        try {
            return MAPPER.readValue(json, clazz);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("JSON deserialization failed", e);
        }
    }

    public static <T> T fromJson(String json, TypeReference<T> typeRef) {
        if (json == null || json.isBlank()) return null;
        try {
            return MAPPER.readValue(json, typeRef);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("JSON deserialization failed", e);
        }
    }

    public static Map<String, Object> toMap(String json) {
        return fromJson(json, new TypeReference<Map<String, Object>>() {});
    }

    public static float[] toFloatArray(String json) {
        if (json == null || json.isBlank()) return new float[0];
        try {
            List<Float> list = MAPPER.readValue(json, new TypeReference<List<Float>>() {});
            float[] arr = new float[list.size()];
            for (int i = 0; i < list.size(); i++) {
                arr[i] = list.get(i);
            }
            return arr;
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Float array deserialization failed", e);
        }
    }

    public static String toJson(float[] arr) {
        if (arr == null) return null;
        try {
            return MAPPER.writeValueAsString(arr);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Float array serialization failed", e);
        }
    }
}
