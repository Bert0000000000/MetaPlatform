package com.metaplatform.process.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class TriggerMatcherTest {

    private TriggerMatcher triggerMatcher;

    @BeforeEach
    void setUp() {
        triggerMatcher = new TriggerMatcher();
    }

    @Test
    void matchesObjectTypeAndEventType() {
        String triggerConfig = """
            {
              "objectType": "order",
              "eventTypes": ["CREATE", "UPDATE"]
            }
            """;

        assertTrue(triggerMatcher.matches("order", "CREATE", Map.of(), triggerConfig));
        assertTrue(triggerMatcher.matches("order", "UPDATE", Map.of(), triggerConfig));
        assertFalse(triggerMatcher.matches("order", "DELETE", Map.of(), triggerConfig));
        assertFalse(triggerMatcher.matches("invoice", "CREATE", Map.of(), triggerConfig));
    }

    @Test
    void matchesNullConfigReturnsFalse() {
        assertFalse(triggerMatcher.matches("order", "CREATE", Map.of(), null));
        assertFalse(triggerMatcher.matches("order", "CREATE", Map.of(), ""));
    }

    @Test
    void matchesEmptyEventTypes() {
        String triggerConfig = """
            {
              "objectType": "order"
            }
            """;

        // No eventTypes constraint means any event type matches
        assertTrue(triggerMatcher.matches("order", "CREATE", Map.of(), triggerConfig));
        assertTrue(triggerMatcher.matches("order", "DELETE", Map.of(), triggerConfig));
    }

    @Test
    void matchesWithEventData() {
        String triggerConfig = """
            {
              "objectType": "order",
              "eventTypes": ["CREATE"],
              "condition": "amount > 1000"
            }
            """;

        Map<String, Object> eventData = Map.of("amount", 5000);
        assertTrue(triggerMatcher.matches("order", "CREATE", eventData, triggerConfig));
    }

    @Test
    void matchesSingleEventType() {
        String triggerConfig = """
            {
              "objectType": "invoice",
              "eventTypes": ["STATUS_CHANGE"]
            }
            """;

        assertTrue(triggerMatcher.matches("invoice", "STATUS_CHANGE", Map.of(), triggerConfig));
        assertFalse(triggerMatcher.matches("invoice", "CREATE", Map.of(), triggerConfig));
    }
}
