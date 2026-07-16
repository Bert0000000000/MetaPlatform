package com.metaplatform.base.integration;

import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RestConnectorTest {

    @Test
    void shouldTransformPullDataWithFieldMapping() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RestConnector connector = new RestConnector("crm", "https://api.example.com", restTemplate);

        FieldMapping mapping = FieldMapping.of(Map.of(
                "ext_name", "name",
                "ext_email", "email"
        ));

        Map<String, Object> raw = Map.of("ext_name", "Alice", "ext_email", "alice@example.com", "extra", "ignored");
        ResponseEntity<Map[]> response = new ResponseEntity<>(new Map[]{raw}, HttpStatus.OK);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(Map[].class)))
                .thenReturn(response);

        List<Map<String, Object>> results = connector.pull(new Connector.PullRequest(
                "/contacts", Map.of("Authorization", "Bearer token"), Map.of(), mapping));

        assertEquals(1, results.size());
        assertEquals("Alice", results.get(0).get("name"));
        assertEquals("alice@example.com", results.get(0).get("email"));
    }

    @Test
    void shouldTransformPushDataWithFieldMapping() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RestConnector connector = new RestConnector("crm", "https://api.example.com", restTemplate);

        FieldMapping mapping = FieldMapping.of(Map.of(
                "name", "ext_name",
                "email", "ext_email"
        ));

        ResponseEntity<String> response = new ResponseEntity<>("OK", HttpStatus.CREATED);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(response);

        Connector.PushResult result = connector.push(new Connector.PushRequest(
                "/contacts", Map.of(), Map.of("name", "Bob", "email", "bob@example.com"), mapping));

        assertTrue(result.success());
        assertEquals(201, result.statusCode());
    }

    @Test
    void shouldReturnFalseOnConnectionTestFailure() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RestConnector connector = new RestConnector("fail", "https://invalid.example.com", restTemplate);

        when(restTemplate.getForEntity(anyString(), eq(String.class)))
                .thenThrow(new RuntimeException("Connection refused"));

        assertFalse(connector.testConnection());
    }
}
