package com.metaplatform.dialogue.domain;

import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.intent.IntentCategory;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class IntentTest {

    @Test
    void shouldCreateIntent() {
        Intent intent = Intent.create("query_objects", IntentCategory.QUERY,
                0.85, Map.of("target", "customer"), "查询所有客户");
        assertNotNull(intent.id());
        assertEquals("query_objects", intent.name());
        assertEquals(IntentCategory.QUERY, intent.category());
        assertEquals(0.85, intent.confidence(), 0.001);
        assertEquals("customer", intent.parameters().get("target"));
        assertEquals("查询所有客户", intent.rawText());
    }

    @Test
    void shouldRejectBlankName() {
        assertThrows(IllegalArgumentException.class,
                () -> Intent.create("", IntentCategory.QUERY, 0.5, null, "text"));
    }

    @Test
    void shouldRejectInvalidConfidence() {
        assertThrows(IllegalArgumentException.class,
                () -> Intent.create("test", IntentCategory.QUERY, -0.1, null, "text"));
        assertThrows(IllegalArgumentException.class,
                () -> Intent.create("test", IntentCategory.QUERY, 1.5, null, "text"));
    }

    @Test
    void shouldCheckConfidenceThreshold() {
        Intent intent = Intent.create("test", IntentCategory.QUERY,
                0.8, null, "text");
        assertTrue(intent.isConfident(0.7));
        assertTrue(intent.isConfident(0.8));
        assertFalse(intent.isConfident(0.9));
    }

    @Test
    void shouldHandleNullParameters() {
        Intent intent = Intent.create("test", IntentCategory.QUERY,
                0.5, null, "text");
        assertTrue(intent.parameters().isEmpty());
    }
}
