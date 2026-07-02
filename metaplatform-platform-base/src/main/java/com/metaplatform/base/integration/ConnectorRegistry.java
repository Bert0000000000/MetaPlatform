package com.metaplatform.base.integration;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ConnectorRegistry {

    private final Map<String, Connector> connectors = new ConcurrentHashMap<>();

    public void register(Connector connector) {
        connectors.put(connector.id(), connector);
    }

    public Connector get(String connectorId) {
        Connector connector = connectors.get(connectorId);
        if (connector == null) {
            throw new IllegalArgumentException("Connector not found: " + connectorId);
        }
        return connector;
    }

    public List<Connector> listAll() {
        return List.copyOf(connectors.values());
    }

    public void unregister(String connectorId) {
        connectors.remove(connectorId);
    }
}
