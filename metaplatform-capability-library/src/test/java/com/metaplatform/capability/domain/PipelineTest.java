package com.metaplatform.capability.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PipelineTest {

    @Test
    void shouldCreatePipeline() {
        Pipeline pipeline = Pipeline.create("test-pipeline", "A test pipeline", List.of(
                new PipelineStep("email", 0, "Send email"),
                new PipelineStep("notification", 1, "Send notification")
        ));
        assertNotNull(pipeline.id());
        assertEquals("test-pipeline", pipeline.name());
        assertEquals(2, pipeline.steps().size());
        assertFalse(pipeline.isEmpty());
    }

    @Test
    void shouldRejectBlankName() {
        assertThrows(IllegalArgumentException.class,
                () -> Pipeline.create("", "desc", List.of()));
    }

    @Test
    void shouldCreateEmptyPipeline() {
        Pipeline pipeline = Pipeline.create("empty", "desc", null);
        assertTrue(pipeline.isEmpty());
    }

    @Test
    void shouldReturnOrderedSteps() {
        Pipeline pipeline = Pipeline.create("ordered", "desc", List.of(
                new PipelineStep("email", 2, "Step 2"),
                new PipelineStep("notification", 0, "Step 0"),
                new PipelineStep("pdf", 1, "Step 1")
        ));
        List<PipelineStep> ordered = pipeline.orderedSteps();
        assertEquals("notification", ordered.get(0).capabilityName());
        assertEquals("pdf", ordered.get(1).capabilityName());
        assertEquals("email", ordered.get(2).capabilityName());
    }

    @Test
    void shouldAddStep() {
        Pipeline pipeline = Pipeline.create("test", "desc", List.of());
        Pipeline updated = pipeline.addStep(new PipelineStep("email", 0, "Send email"));
        assertEquals(1, updated.steps().size());
        assertEquals(0, pipeline.steps().size()); // 不变性
    }

    @Test
    void shouldRejectInvalidPipelineStep() {
        assertThrows(IllegalArgumentException.class,
                () -> new PipelineStep("", 0, "desc"));
        assertThrows(IllegalArgumentException.class,
                () -> new PipelineStep("email", -1, "desc"));
    }
}
