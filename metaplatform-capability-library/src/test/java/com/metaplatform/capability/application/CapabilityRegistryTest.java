package com.metaplatform.capability.application;

import com.metaplatform.capability.domain.*;
import com.metaplatform.capability.infrastructure.capabilities.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CapabilityRegistryTest {

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
    }

    @Test
    void shouldRegisterAllBuiltinCapabilities() {
        assertEquals(10, registry.count());
    }

    @Test
    void shouldFindByName() {
        assertTrue(registry.findByName("email").isPresent());
        assertEquals("email", registry.findByName("email").get().name());
        assertTrue(registry.findByName("sms").isPresent());
        assertTrue(registry.findByName("ai-summary").isPresent());
        assertTrue(registry.findByName("translation").isPresent());
        assertTrue(registry.findByName("pdf").isPresent());
        assertTrue(registry.findByName("export").isPresent());
        assertTrue(registry.findByName("notification").isPresent());
        assertTrue(registry.findByName("http").isPresent());
        assertTrue(registry.findByName("validation").isPresent());
        assertTrue(registry.findByName("ai-classification").isPresent());
    }

    @Test
    void shouldReturnEmptyForUnknownName() {
        assertTrue(registry.findByName("nonexistent").isEmpty());
    }

    @Test
    void shouldFindByType() {
        List<Capability> comm = registry.findByType(CapabilityType.COMMUNICATION);
        assertEquals(3, comm.size()); // email, sms, notification

        List<Capability> ai = registry.findByType(CapabilityType.AI);
        assertEquals(3, ai.size()); // ai-summary, translation, ai-classification

        List<Capability> file = registry.findByType(CapabilityType.FILE);
        assertEquals(2, file.size()); // pdf, export

        List<Capability> network = registry.findByType(CapabilityType.NETWORK);
        assertEquals(1, network.size()); // http

        List<Capability> data = registry.findByType(CapabilityType.DATA);
        assertEquals(1, data.size()); // validation
    }

    @Test
    void shouldCheckContains() {
        assertTrue(registry.contains("email"));
        assertFalse(registry.contains("nonexistent"));
    }
}
