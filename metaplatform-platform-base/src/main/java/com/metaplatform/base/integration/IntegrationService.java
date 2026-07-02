package com.metaplatform.base.integration;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class IntegrationService {

    private final ConnectorRegistry registry;

    public IntegrationService(ConnectorRegistry registry) {
        this.registry = registry;
    }

    public boolean testConnector(String connectorId) {
        return registry.get(connectorId).testConnection();
    }

    public List<Map<String, Object>> pullData(String connectorId, Connector.PullRequest request) {
        return registry.get(connectorId).pull(request);
    }

    public Connector.PushResult pushData(String connectorId, Connector.PushRequest request) {
        return registry.get(connectorId).push(request);
    }

    public List<Connector> listConnectors() {
        return registry.listAll();
    }
}
