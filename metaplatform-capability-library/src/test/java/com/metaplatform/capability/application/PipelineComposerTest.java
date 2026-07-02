package com.metaplatform.capability.application;

import com.metaplatform.capability.domain.*;
import com.metaplatform.capability.infrastructure.capabilities.*;
import com.metaplatform.capability.infrastructure.memory.InMemoryPipelineRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PipelineComposerTest {

    private PipelineComposer pipelineComposer;
    private CapabilityRegistry registry;

    @BeforeEach
    void setUp() {
        List<Capability> capabilities = List.of(
                new EmailCapability(),
                new SmsCapability(),
                new AiSummaryCapability(),
                new TranslationCapability(),
                new PdfCapability(),
                new ExportCapability(),
                new NotificationCapability(),
                new HttpCapability(),
                new ValidationCapability(),
                new AiClassificationCapability()
        );
        registry = new CapabilityRegistry(capabilities);
        InMemoryPipelineRepository pipelineRepository = new InMemoryPipelineRepository();
        pipelineComposer = new PipelineComposer(pipelineRepository, registry);
    }

    @Test
    void shouldCreatePipeline() {
        Pipeline pipeline = pipelineComposer.createPipeline(
                "send-report",
                "Generate and send report",
                List.of(
                        new PipelineStep("export", 0, "Export data"),
                        new PipelineStep("email", 1, "Send via email")
                )
        );
        assertNotNull(pipeline.id());
        assertEquals("send-report", pipeline.name());
        assertEquals(2, pipeline.steps().size());
    }

    @Test
    void shouldRejectUnknownCapability() {
        assertThrows(IllegalArgumentException.class,
                () -> pipelineComposer.createPipeline(
                        "bad-pipeline", "desc",
                        List.of(new PipelineStep("nonexistent", 0, "desc"))
                ));
    }

    @Test
    void shouldExecutePipeline() {
        Pipeline pipeline = pipelineComposer.createPipeline(
                "classify-and-notify",
                "Classify text and send notification",
                List.of(
                        new PipelineStep("ai-classification", 0, "Classify"),
                        new PipelineStep("notification", 1, "Notify")
                )
        );

        List<CapabilityResult> results = pipelineComposer.executePipeline(
                pipeline.id(),
                CapabilityContext.of(Map.of(
                        "text", "这是一个技术类问题",
                        "userId", "user-1",
                        "title", "分类结果",
                        "message", "分类完成"
                ))
        );

        assertEquals(2, results.size());
        assertTrue(results.get(0).success());
        assertTrue(results.get(1).success());
    }

    @Test
    void shouldStopOnFailure() {
        Pipeline pipeline = pipelineComposer.createPipeline(
                "will-fail",
                "Pipeline that fails at step 2",
                List.of(
                        new PipelineStep("notification", 0, "Notify"),
                        new PipelineStep("email", 1, "Send email - will fail without 'to'")
                )
        );

        List<CapabilityResult> results = pipelineComposer.executePipeline(
                pipeline.id(),
                CapabilityContext.of(Map.of(
                        "userId", "user-1",
                        "title", "Test",
                        "message", "Test"
                ))
        );

        // 第一步成功，第二步失败（缺少 to 参数）
        assertEquals(2, results.size());
        assertTrue(results.get(0).success());
        assertFalse(results.get(1).success());
    }

    @Test
    void shouldFindAll() {
        pipelineComposer.createPipeline("p1", "desc1", List.of());
        pipelineComposer.createPipeline("p2", "desc2", List.of());

        List<Pipeline> pipelines = pipelineComposer.findAll();
        assertEquals(2, pipelines.size());
    }

    @Test
    void shouldDeletePipeline() {
        Pipeline pipeline = pipelineComposer.createPipeline("to-delete", "desc", List.of());
        pipelineComposer.deletePipeline(pipeline.id());

        assertThrows(IllegalArgumentException.class,
                () -> pipelineComposer.getPipeline(pipeline.id()));
    }
}
