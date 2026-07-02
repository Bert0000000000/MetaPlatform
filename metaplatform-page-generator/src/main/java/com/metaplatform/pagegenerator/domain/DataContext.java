package com.metaplatform.pagegenerator.domain;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;

/**
 * 数据上下文 - 用于页面渲染时注入当前数据
 */
public class DataContext {

    private Map<String, JsonNode> values;

    public DataContext() {}

    public DataContext(Map<String, JsonNode> values) {
        this.values = values;
    }

    public boolean hasValue(String fieldCode) {
        return values != null && values.containsKey(fieldCode);
    }

    public JsonNode getValue(String fieldCode) {
        return values != null ? values.get(fieldCode) : null;
    }

    public Map<String, JsonNode> getValues() { return values; }
    public void setValues(Map<String, JsonNode> values) { this.values = values; }
}
