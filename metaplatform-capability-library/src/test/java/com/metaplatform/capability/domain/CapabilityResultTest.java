package com.metaplatform.capability.domain;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CapabilityResultTest {

    @Test
    void shouldCreateSuccessResult() {
        CapabilityResult result = CapabilityResult.success("OK", Map.of("key", "value"));
        assertTrue(result.success());
        assertEquals("OK", result.message());
        assertEquals("value", result.data().get("key"));
    }

    @Test
    void shouldCreateSuccessResultWithTime() {
        CapabilityResult result = CapabilityResult.success("OK", Map.of(), 150);
        assertTrue(result.success());
        assertEquals(150, result.executionTimeMs());
    }

    @Test
    void shouldCreateFailureResult() {
        CapabilityResult result = CapabilityResult.failure("Error occurred");
        assertFalse(result.success());
        assertEquals("Error occurred", result.message());
        assertTrue(result.data().isEmpty());
    }

    @Test
    void shouldCreateFailureResultWithTime() {
        CapabilityResult result = CapabilityResult.failure("Timeout", 5000);
        assertFalse(result.success());
        assertEquals(5000, result.executionTimeMs());
    }
}
