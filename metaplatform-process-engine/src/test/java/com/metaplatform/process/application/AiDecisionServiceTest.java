package com.metaplatform.process.application;

import com.metaplatform.process.domain.dsl.ProcessNode;
import com.metaplatform.process.domain.dsl.Transition;
import com.metaplatform.process.domain.enums.GatewayType;
import com.metaplatform.process.domain.enums.NodeType;
import com.metaplatform.process.infrastructure.exception.ProcessEngineException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AI decision node.
 * Verifies mock LLM response handling and branch selection.
 */
@ExtendWith(MockitoExtension.class)
class AiDecisionServiceTest {

    private RestTemplate mockRestTemplate;
    private AiDecisionService aiDecisionService;

    @BeforeEach
    void setUp() {
        mockRestTemplate = mock(RestTemplate.class);

        // Create AiDecisionService with a mocked RestTemplate
        // We use RestTemplateBuilder to inject the mock
        RestTemplateBuilder mockBuilder = mock(RestTemplateBuilder.class);
        when(mockBuilder.setConnectTimeout(any())).thenReturn(mockBuilder);
        when(mockBuilder.setReadTimeout(any())).thenReturn(mockBuilder);
        when(mockBuilder.build()).thenReturn(mockRestTemplate);

        aiDecisionService = new AiDecisionService(mockBuilder, "http://localhost:8084");
    }

    @Test
    void evaluateDecisionReturnsBranchFromLlmResponse() {
        // Setup
        ProcessNode gateway = new ProcessNode("ai_gateway", NodeType.GATEWAY, "AI Decision");
        gateway.setGatewayType(GatewayType.XOR);
        gateway.setTaskType(com.metaplatform.process.domain.enums.TaskType.AI_DECISION);

        List<Transition> transitions = List.of(
            new Transition("ai_gateway", "branch_approve", "amount < 1000"),
            new Transition("ai_gateway", "branch_reject", "amount >= 1000")
        );

        Map<String, Object> variables = Map.of("amount", 500);

        // Mock LLM response
        Map<String, Object> choice = Map.of("text", "branch_approve");
        Map<String, Object> responseBody = Map.of("choices", List.of(choice));
        ResponseEntity<Map> responseEntity = new ResponseEntity<>(responseBody, HttpStatus.OK);

        when(mockRestTemplate.exchange(
            eq("http://localhost:8084/v1/completions"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(Map.class)
        )).thenReturn(responseEntity);

        // Execute
        String result = aiDecisionService.evaluateDecision(gateway, transitions, variables);

        // Verify
        assertEquals("branch_approve", result);
        verify(mockRestTemplate).exchange(
            eq("http://localhost:8084/v1/completions"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(Map.class)
        );
    }

    @Test
    void evaluateDecisionWithCustomPrompt() {
        // Setup
        ProcessNode gateway = new ProcessNode("ai_gateway", NodeType.GATEWAY, "AI Decision");
        gateway.setGatewayType(GatewayType.XOR);
        gateway.setTaskType(com.metaplatform.process.domain.enums.TaskType.AI_DECISION);
        gateway.setAiDecisionPrompt("Is the risk level acceptable for this transaction?");

        List<Transition> transitions = List.of(
            new Transition("ai_gateway", "low_risk"),
            new Transition("ai_gateway", "high_risk")
        );

        Map<String, Object> variables = Map.of("riskScore", 3, "amount", 50000);

        // Mock LLM response -- returns second branch
        Map<String, Object> choice = Map.of("text", "high_risk");
        Map<String, Object> responseBody = Map.of("choices", List.of(choice));
        ResponseEntity<Map> responseEntity = new ResponseEntity<>(responseBody, HttpStatus.OK);

        when(mockRestTemplate.exchange(
            eq("http://localhost:8084/v1/completions"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(Map.class)
        )).thenReturn(responseEntity);

        // Execute
        String result = aiDecisionService.evaluateDecision(gateway, transitions, variables);

        // Verify
        assertEquals("high_risk", result);
    }

    @Test
    void evaluateDecisionWithMessageContentResponseFormat() {
        // Setup
        ProcessNode gateway = new ProcessNode("ai_gateway", NodeType.GATEWAY, "AI Decision");

        List<Transition> transitions = List.of(
            new Transition("ai_gateway", "path_a"),
            new Transition("ai_gateway", "path_b")
        );

        // Mock LLM response -- message format
        Map<String, Object> message = Map.of("content", "path_b");
        Map<String, Object> choice = Map.of("message", message);
        Map<String, Object> responseBody = Map.of("choices", List.of(choice));
        ResponseEntity<Map> responseEntity = new ResponseEntity<>(responseBody, HttpStatus.OK);

        when(mockRestTemplate.exchange(
            anyString(), any(), any(), eq(Map.class)
        )).thenReturn(responseEntity);

        // Execute
        String result = aiDecisionService.evaluateDecision(gateway, transitions, Map.of("x", 1));

        // Verify
        assertEquals("path_b", result);
    }

    @Test
    void evaluateDecisionWithEmptyTransitionsThrows() {
        ProcessNode gateway = new ProcessNode("ai_gateway", NodeType.GATEWAY, "AI Decision");

        assertThrows(ProcessEngineException.class,
            () -> aiDecisionService.evaluateDecision(gateway, List.of(), Map.of()));
    }

    @Test
    void evaluateDecisionWithNullTransitionsThrows() {
        ProcessNode gateway = new ProcessNode("ai_gateway", NodeType.GATEWAY, "AI Decision");

        assertThrows(ProcessEngineException.class,
            () -> aiDecisionService.evaluateDecision(gateway, null, Map.of()));
    }

    @Test
    void evaluateDecisionWithLlmErrorThrows() {
        // Setup
        ProcessNode gateway = new ProcessNode("ai_gateway", NodeType.GATEWAY, "AI Decision");

        List<Transition> transitions = List.of(
            new Transition("ai_gateway", "branch_a"),
            new Transition("ai_gateway", "branch_b")
        );

        when(mockRestTemplate.exchange(
            anyString(), any(), any(), eq(Map.class)
        )).thenThrow(new RuntimeException("Connection refused"));

        // Execute
        assertThrows(ProcessEngineException.class,
            () -> aiDecisionService.evaluateDecision(gateway, transitions, Map.of("x", 1)));
    }

    @Test
    void evaluateDecisionDefaultsToFirstBranchOnUnparseableResponse() {
        // Setup
        ProcessNode gateway = new ProcessNode("ai_gateway", NodeType.GATEWAY, "AI Decision");

        List<Transition> transitions = List.of(
            new Transition("ai_gateway", "expected_branch"),
            new Transition("ai_gateway", "other_branch")
        );

        // Mock LLM response -- unparseable
        Map<String, Object> responseBody = Map.of("choices", List.of(Map.of("text", "something_unexpected")));
        ResponseEntity<Map> responseEntity = new ResponseEntity<>(responseBody, HttpStatus.OK);

        when(mockRestTemplate.exchange(
            anyString(), any(), any(), eq(Map.class)
        )).thenReturn(responseEntity);

        // Execute -- should fallback to first branch
        String result = aiDecisionService.evaluateDecision(gateway, transitions, Map.of());

        // Verify
        assertEquals("expected_branch", result);
    }

    @Test
    void evaluateDecisionWithAlternativeResponseFormat() {
        // Setup
        ProcessNode gateway = new ProcessNode("ai_gateway", NodeType.GATEWAY, "AI Decision");

        List<Transition> transitions = List.of(
            new Transition("ai_gateway", "approve"),
            new Transition("ai_gateway", "deny")
        );

        // Mock: response uses "result" key instead of "choices"
        Map<String, Object> responseBody = Map.of("result", "approve");
        ResponseEntity<Map> responseEntity = new ResponseEntity<>(responseBody, HttpStatus.OK);

        when(mockRestTemplate.exchange(
            anyString(), any(), any(), eq(Map.class)
        )).thenReturn(responseEntity);

        // Execute
        String result = aiDecisionService.evaluateDecision(gateway, transitions, Map.of("amount", 100));

        // Verify
        assertEquals("approve", result);
    }
}
