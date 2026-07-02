package com.metaplatform.process.application;

import com.metaplatform.process.infrastructure.util.JsonUtils;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class TriggerMatcher {

    /**
     * Check if an event matches the trigger configuration
     */
    public boolean matches(String objectType, String eventType,
                            Map<String, Object> eventData, String triggerConfigJson) {
        if (triggerConfigJson == null || triggerConfigJson.isBlank()) return false;

        Map<String, Object> config = JsonUtils.fromJson(triggerConfigJson, Map.class);
        if (config == null) return false;

        // Match object type
        String configObjectType = (String) config.get("objectType");
        if (configObjectType != null && !configObjectType.equals(objectType)) {
            return false;
        }

        // Match event types
        Object eventTypesObj = config.get("eventTypes");
        if (eventTypesObj instanceof List<?> eventTypes) {
            if (!eventTypes.contains(eventType)) return false;
        }

        // Match condition (simplified v0.1 - just checks key presence)
        String condition = (String) config.get("condition");
        if (condition != null && !condition.isBlank()) {
            return evaluateCondition(condition, eventData);
        }

        return true;
    }

    private boolean evaluateCondition(String condition, Map<String, Object> eventData) {
        // v0.1 simplified: just check if required fields exist
        // Full Aviator evaluation can be added in v0.2
        return eventData != null;
    }
}
