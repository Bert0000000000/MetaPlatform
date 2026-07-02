package com.metaplatform.base.interfaces.rest;

import com.metaplatform.base.integration.*;
import com.metaplatform.base.interfaces.rest.dto.ConnectorConfigRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/integrations")
public class IntegrationController {

    private final ConnectorRegistry registry;
    private final IntegrationService integrationService;

    public IntegrationController(ConnectorRegistry registry, IntegrationService integrationService) {
        this.registry = registry;
        this.integrationService = integrationService;
    }

    @PostMapping("/connectors")
    public ResponseEntity<Map<String, Object>> registerConnector(
            @Valid @RequestBody ConnectorConfigRequest request) {
        RestTemplate restTemplate = new RestTemplate();
        RestConnector connector = new RestConnector(request.id(), request.baseUrl(), restTemplate);
        registry.register(connector);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", connector.id(),
                "type", connector.type(),
                "baseUrl", request.baseUrl(),
                "status", "registered"
        ));
    }

    @GetMapping("/connectors")
    public ResponseEntity<List<Map<String, Object>>> listConnectors() {
        List<Map<String, Object>> connectors = integrationService.listConnectors().stream()
                .map(c -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id", c.id());
                    m.put("type", c.type());
                    return m;
                })
                .toList();
        return ResponseEntity.ok(connectors);
    }

    @PostMapping("/connectors/{id}/test")
    public ResponseEntity<Map<String, Object>> testConnector(@PathVariable String id) {
        boolean connected = integrationService.testConnector(id);
        return ResponseEntity.ok(Map.of(
                "connectorId", id,
                "connected", connected
        ));
    }

    @DeleteMapping("/connectors/{id}")
    public ResponseEntity<Void> unregisterConnector(@PathVariable String id) {
        registry.unregister(id);
        return ResponseEntity.noContent().build();
    }
}
