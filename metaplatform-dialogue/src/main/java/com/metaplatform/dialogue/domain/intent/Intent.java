package com.metaplatform.dialogue.domain.intent;

import java.util.Map;
import java.util.Objects;

/**
 * 意图实体。表示自然语言解析后识别出的用户意图。
 */
public class Intent {
    private final IntentId id;
    private final String name;
    private final IntentCategory category;
    private final double confidence;
    private final Map<String, String> parameters;
    private final String rawText;

    public Intent(IntentId id, String name, IntentCategory category,
                  double confidence, Map<String, String> parameters, String rawText) {
        this.id = Objects.requireNonNull(id, "id");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Intent name must not be blank");
        }
        this.name = name;
        this.category = Objects.requireNonNull(category, "category");
        if (confidence < 0.0 || confidence > 1.0) {
            throw new IllegalArgumentException("Confidence must be between 0.0 and 1.0");
        }
        this.confidence = confidence;
        this.parameters = parameters != null ? Map.copyOf(parameters) : Map.of();
        this.rawText = rawText != null ? rawText : "";
    }

    public static Intent create(String name, IntentCategory category, double confidence,
                                 Map<String, String> parameters, String rawText) {
        return new Intent(IntentId.newId(), name, category, confidence, parameters, rawText);
    }

    public IntentId id() { return id; }
    public String name() { return name; }
    public IntentCategory category() { return category; }
    public double confidence() { return confidence; }
    public Map<String, String> parameters() { return parameters; }
    public String rawText() { return rawText; }

    /**
     * 判断意图是否可信（超过给定阈值）。
     */
    public boolean isConfident(double threshold) {
        return confidence >= threshold;
    }
}
