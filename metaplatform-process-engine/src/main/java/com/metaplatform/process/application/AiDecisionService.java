package com.metaplatform.process.application;

import com.metaplatform.process.domain.dsl.ProcessNode;
import com.metaplatform.process.domain.dsl.Transition;
import com.metaplatform.process.infrastructure.exception.ProcessEngineException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * AI-powered decision service that uses AI Substrate LLM
 * to evaluate gateway conditions and determine the correct branch.
 */
@Service
public class AiDecisionService {

    private static final Logger log = LoggerFactory.getLogger(AiDecisionService.class);

    private final RestTemplate restTemplate;
    private final String aiSubstrateUrl;

    public AiDecisionService(RestTemplateBuilder restTemplateBuilder,
                              @Value("${metaplatform.process.ai-substrate-url:http://localhost:8084}") String aiSubstrateUrl) {
        this.restTemplate = restTemplateBuilder
            .setConnectTimeout(Duration.ofSeconds(5))
            .setReadTimeout(Duration.ofSeconds(30))
            .build();
        this.aiSubstrateUrl = aiSubstrateUrl;
    }

    /**
     * Evaluate a decision using the AI Substrate LLM.
     *
     * @param gatewayNode   the gateway node configuration
     * @param outgoingTransitions the outgoing transition branches
     * @param variables     current process variables
     * @return the chosen target node ID (branch)
     */
    public String evaluateDecision(ProcessNode gatewayNode,
                                    List<Transition> outgoingTransitions,
                                    Map<String, Object> variables) {
        if (outgoingTransitions == null || outgoingTransitions.isEmpty()) {
            throw new ProcessEngineException("AI Decision gateway has no outgoing transitions");
        }

        // Build the prompt for the LLM
        String prompt = buildPrompt(gatewayNode, outgoingTransitions, variables);

        log.info("AI Decision request for gateway '{}': evaluating {} branches",
            gatewayNode.getId(), outgoingTransitions.size());

        try {
            // Call AI Substrate
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("prompt", prompt);
            requestBody.put("model", "decision-maker");
            requestBody.put("max_tokens", 256);
            requestBody.put("temperature", 0.1);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                aiSubstrateUrl + "/v1/completions",
                HttpMethod.POST,
                entity,
                Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                String chosenBranch = extractBranchFromResponse(body, outgoingTransitions);

                log.info("AI Decision for gateway '{}': chosen branch -> {}", gatewayNode.getId(), chosenBranch);
                return chosenBranch;
            } else {
                throw new ProcessEngineException("AI Substrate returned non-success status: " + response.getStatusCode());
            }
        } catch (ProcessEngineException e) {
            throw e;
        } catch (Exception e) {
            log.error("AI Decision request failed for gateway '{}': {}", gatewayNode.getId(), e.getMessage());
            throw new ProcessEngineException("AI Decision evaluation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Build a structured prompt for the LLM from gateway configuration and variables.
     */
    private String buildPrompt(ProcessNode gatewayNode, List<Transition> transitions,
                                Map<String, Object> variables) {
        StringBuilder sb = new StringBuilder();

        // Custom prompt if provided
        if (gatewayNode.getAiDecisionPrompt() != null && !gatewayNode.getAiDecisionPrompt().isBlank()) {
            sb.append(gatewayNode.getAiDecisionPrompt()).append("\n\n");
        } else {
            sb.append("You are a process engine decision maker. Based on the current process variables, ");
            sb.append("determine which branch the process should take.\n\n");
        }

        // Current variables
        sb.append("Current process variables:\n");
        for (Map.Entry<String, Object> entry : variables.entrySet()) {
            sb.append("  - ").append(entry.getKey()).append(" = ").append(entry.getValue()).append("\n");
        }

        // Available branches
        sb.append("\nAvailable branches (respond with the branch ID only):\n");
        for (int i = 0; i < transitions.size(); i++) {
            Transition t = transitions.get(i);
            sb.append("  ").append(i + 1).append(". Branch ID: ").append(t.getTo());
            if (t.getCondition() != null && !t.getCondition().isBlank()) {
                sb.append(" (condition: ").append(t.getCondition()).append(")");
            }
            sb.append("\n");
        }

        sb.append("\nRespond with ONLY the branch ID (e.g., '").append(transitions.get(0).getTo()).append("').");

        return sb.toString();
    }

    /**
     * Extract the chosen branch ID from the LLM response.
     */
    @SuppressWarnings("unchecked")
    private String extractBranchFromResponse(Map<String, Object> response, List<Transition> transitions) {
        // Extract text from response (typical LLM response format)
        String text = "";
        if (response.containsKey("choices")) {
            Object choices = response.get("choices");
            if (choices instanceof List<?> choiceList && !choiceList.isEmpty()) {
                Object first = choiceList.get(0);
                if (first instanceof Map<?, ?> choiceMap) {
                    Object textObj = choiceMap.get("text");
                    if (textObj == null) {
                        textObj = choiceMap.get("message");
                        if (textObj instanceof Map<?, ?> msgMap) {
                            textObj = msgMap.get("content");
                        }
                    }
                    if (textObj != null) {
                        text = textObj.toString().trim();
                    }
                }
            }
        } else if (response.containsKey("text")) {
            text = response.get("text").toString().trim();
        } else if (response.containsKey("result")) {
            text = response.get("result").toString().trim();
        }

        // Match response to a known branch ID
        String finalText = text;
        return transitions.stream()
            .map(Transition::getTo)
            .filter(targetNodeId -> finalText.contains(targetNodeId))
            .findFirst()
            .orElseGet(() -> {
                // Fallback: try to match by index number
                try {
                    int index = Integer.parseInt(finalText.replaceAll("[^0-9]", "")) - 1;
                    if (index >= 0 && index < transitions.size()) {
                        return transitions.get(index).getTo();
                    }
                } catch (NumberFormatException ignored) {}

                // Last resort: take the first branch
                log.warn("Could not match AI response '{}' to any branch, defaulting to first branch", finalText);
                return transitions.get(0).getTo();
            });
    }
}
