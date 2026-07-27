package com.metaplatform.wfe.engine.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * IFlowValue 的 Java 表示。
 * type: "constant" | "template" | "ref"
 * content: 常量值 / 模板字符串 / [nodeId, varName]
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record FlowValue(String type, Object content) {

    public boolean isConstant() {
        return "constant".equals(type);
    }

    public boolean isTemplate() {
        return "template".equals(type);
    }

    public boolean isRef() {
        return "ref".equals(type);
    }
}
