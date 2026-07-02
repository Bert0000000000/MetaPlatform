package com.metaplatform.capability.application;

import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.infrastructure.capabilities.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CapabilityExecutionServiceTest {

    private CapabilityExecutionService executionService;

    @BeforeEach
    void setUp() {
        List<com.metaplatform.capability.domain.Capability> capabilities = List.of(
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
        CapabilityRegistry registry = new CapabilityRegistry(capabilities);
        executionService = new CapabilityExecutionService(registry);
    }

    @Test
    void shouldExecuteEmail() {
        CapabilityResult result = executionService.execute("email",
                CapabilityContext.of(Map.of("to", "test@example.com", "subject", "Test")));
        assertTrue(result.success());
        assertTrue(result.message().contains("test@example.com"));
    }

    @Test
    void shouldExecuteSms() {
        CapabilityResult result = executionService.execute("sms",
                CapabilityContext.of(Map.of("phoneNumber", "13800138000", "message", "Hello")));
        assertTrue(result.success());
    }

    @Test
    void shouldExecuteAiSummary() {
        CapabilityResult result = executionService.execute("ai-summary",
                CapabilityContext.of(Map.of("text", "This is a long text that needs to be summarized.")));
        assertTrue(result.success());
        assertTrue(result.data().containsKey("summary"));
    }

    @Test
    void shouldExecuteTranslation() {
        CapabilityResult result = executionService.execute("translation",
                CapabilityContext.of(Map.of("text", "Hello", "targetLanguage", "zh")));
        assertTrue(result.success());
        assertTrue(result.data().containsKey("translated"));
    }

    @Test
    void shouldExecutePdf() {
        CapabilityResult result = executionService.execute("pdf",
                CapabilityContext.of(Map.of("content", "PDF content", "filename", "test.pdf")));
        assertTrue(result.success());
        assertEquals("test.pdf", result.data().get("filename"));
    }

    @Test
    void shouldExecuteExport() {
        CapabilityResult result = executionService.execute("export",
                CapabilityContext.of(Map.of("data", "{\"key\":\"value\"}", "format", "csv")));
        assertTrue(result.success());
        assertEquals("csv", result.data().get("format"));
    }

    @Test
    void shouldExecuteNotification() {
        CapabilityResult result = executionService.execute("notification",
                CapabilityContext.of(Map.of("userId", "user-1", "title", "Test")));
        assertTrue(result.success());
    }

    @Test
    void shouldExecuteHttp() {
        CapabilityResult result = executionService.execute("http",
                CapabilityContext.of(Map.of("url", "https://example.com", "method", "GET")));
        assertTrue(result.success());
        assertEquals(200, result.data().get("statusCode"));
    }

    @Test
    void shouldExecuteValidation() {
        CapabilityResult result = executionService.execute("validation",
                CapabilityContext.of(Map.of(
                        "data", Map.of("name", "test"),
                        "rules", Map.of("required", List.of("name", "email"))
                )));
        assertTrue(result.success());
        assertEquals(false, result.data().get("valid"));
    }

    @Test
    void shouldExecuteClassification() {
        CapabilityResult result = executionService.execute("ai-classification",
                CapabilityContext.of(Map.of("text", "这是一个关于代码开发的技术问题")));
        assertTrue(result.success());
        assertNotNull(result.data().get("category"));
    }

    @Test
    void shouldRejectUnknownCapability() {
        assertThrows(IllegalArgumentException.class,
                () -> executionService.execute("nonexistent", CapabilityContext.empty()));
    }
}
