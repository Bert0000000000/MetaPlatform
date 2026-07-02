package com.metaplatform.process.domain.dsl;

import com.metaplatform.process.domain.enums.NodeType;

import java.util.ArrayList;
import java.util.List;

public class ProcessDsl {
    private String key;
    private String name;
    private String description;
    private List<VariableDefinition> variables = new ArrayList<>();
    private List<ProcessNode> nodes = new ArrayList<>();
    private List<Transition> transitions = new ArrayList<>();

    public ProcessDsl() {}

    public ProcessNode getStartNode() {
        return nodes.stream()
            .filter(n -> n.getType() == NodeType.START)
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("No START node found in DSL"));
    }

    public ProcessNode getNodeById(String id) {
        return nodes.stream()
            .filter(n -> n.getId().equals(id))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("Node not found: " + id));
    }

    public List<Transition> getOutgoingTransitions(String nodeId) {
        return transitions.stream()
            .filter(t -> t.getFrom().equals(nodeId))
            .toList();
    }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public List<VariableDefinition> getVariables() { return variables; }
    public void setVariables(List<VariableDefinition> variables) { this.variables = variables; }
    public List<ProcessNode> getNodes() { return nodes; }
    public void setNodes(List<ProcessNode> nodes) { this.nodes = nodes; }
    public List<Transition> getTransitions() { return transitions; }
    public void setTransitions(List<Transition> transitions) { this.transitions = transitions; }
}
