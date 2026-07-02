package com.metaplatform.ai.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.HashMap;
import java.util.Map;

/**
 * Model alias routing: maps aliases (e.g., "fast", "smart") to actual model names.
 */
@ConfigurationProperties(prefix = "ai")
public class ModelAlias {

    private Map<String, String> modelAliases = new HashMap<>();

    public Map<String, String> getModelAliases() {
        return modelAliases;
    }

    public void setModelAliases(Map<String, String> modelAliases) {
        this.modelAliases = modelAliases != null ? modelAliases : new HashMap<>();
    }

    /**
     * Resolve model name: if it's an alias, return the actual model name; otherwise, return as-is.
     */
    public String resolve(String modelOrAlias) {
        return modelAliases.getOrDefault(modelOrAlias, modelOrAlias);
    }
}
