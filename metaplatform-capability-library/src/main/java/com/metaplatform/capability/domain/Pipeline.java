package com.metaplatform.capability.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 流水线聚合根。由多个有序步骤组成的能力编排。
 */
public class Pipeline {
    private final PipelineId id;
    private final String name;
    private final String description;
    private final List<PipelineStep> steps;

    public Pipeline(PipelineId id, String name, String description, List<PipelineStep> steps) {
        this.id = Objects.requireNonNull(id, "id");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Pipeline name must not be blank");
        }
        this.name = name;
        this.description = description != null ? description : "";
        this.steps = steps != null ? List.copyOf(steps) : List.of();
    }

    public static Pipeline create(String name, String description, List<PipelineStep> steps) {
        return new Pipeline(PipelineId.newId(), name, description, steps);
    }

    public PipelineId id() { return id; }
    public String name() { return name; }
    public String description() { return description; }
    public List<PipelineStep> steps() { return steps; }

    /**
     * 获取有序步骤列表（按 order 排序）。
     */
    public List<PipelineStep> orderedSteps() {
        return steps.stream()
                .sorted((a, b) -> Integer.compare(a.order(), b.order()))
                .toList();
    }

    /**
     * 流水线是否为空。
     */
    public boolean isEmpty() {
        return steps.isEmpty();
    }

    /**
     * 添加步骤（返回新实例，保持不可变性）。
     */
    public Pipeline addStep(PipelineStep step) {
        var newSteps = new ArrayList<>(steps);
        newSteps.add(step);
        return new Pipeline(id, name, description, newSteps);
    }
}
