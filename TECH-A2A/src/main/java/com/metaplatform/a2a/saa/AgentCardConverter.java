package com.metaplatform.a2a.saa;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.a2a.entity.AgentCardEntity;
import io.a2a.spec.AgentCapabilities;
import io.a2a.spec.AgentCard;
import io.a2a.spec.AgentSkill;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class AgentCardConverter {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public AgentCard toSaaAgentCard(AgentCardEntity entity) {
        Map<String, Object> endpoints = readMap(entity.getEndpoints());
        List<String> capabilityNames = readStringList(entity.getCapabilities());

        return new AgentCard.Builder()
                .name(entity.getName())
                .description(entity.getDescription())
                .url(stringValue(endpoints.get("url"), "http://localhost:8502/api/v1/a2a/inbound/jsonrpc"))
                .version(entity.getVersion())
                .protocolVersion(entity.getProtocolVersion())
                .preferredTransport(stringValue(endpoints.get("transport"), "JSONRPC"))
                .capabilities(toCapabilities(capabilityNames))
                .defaultInputModes(List.of("text"))
                .defaultOutputModes(List.of("text"))
                .skills(toSkills(capabilityNames))
                .supportsAuthenticatedExtendedCard(false)
                .build();
    }

    private AgentCapabilities toCapabilities(List<String> names) {
        return new AgentCapabilities.Builder()
                .streaming(names.stream().anyMatch("streaming"::equalsIgnoreCase))
                .pushNotifications(names.stream().anyMatch("pushNotifications"::equalsIgnoreCase))
                .stateTransitionHistory(names.stream().anyMatch("stateTransitionHistory"::equalsIgnoreCase))
                .build();
    }

    private List<AgentSkill> toSkills(List<String> names) {
        List<AgentSkill> skills = new ArrayList<>();
        for (String name : names) {
            if (isProtocolCapability(name)) {
                continue;
            }
            skills.add(new AgentSkill.Builder()
                    .id(name)
                    .name(name)
                    .description(name)
                    .tags(List.of(name))
                    .inputModes(List.of("text"))
                    .outputModes(List.of("text"))
                    .build());
        }
        return skills;
    }

    private boolean isProtocolCapability(String name) {
        return "streaming".equalsIgnoreCase(name)
                || "pushNotifications".equalsIgnoreCase(name)
                || "stateTransitionHistory".equalsIgnoreCase(name);
    }

    private Map<String, Object> readMap(String json) {
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    private List<String> readStringList(String json) {
        try {
            return objectMapper.readValue(json, STRING_LIST_TYPE);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String stringValue(Object value, String fallback) {
        return value != null && !value.toString().isBlank() ? value.toString() : fallback;
    }
}
