package com.metaplatform.process.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.process.domain.dsl.*;
import com.metaplatform.process.domain.enums.*;
import com.metaplatform.process.infrastructure.exception.DslParseException;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
public class DslParser {

    private final ObjectMapper objectMapper;

    public DslParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ProcessDsl parse(String dslJson) {
        try {
            JsonNode root = objectMapper.readTree(dslJson);

            ProcessDsl dsl = new ProcessDsl();
            dsl.setKey(root.get("key").asText());
            dsl.setName(root.get("name").asText());
            dsl.setDescription(root.has("description") ?
                root.get("description").asText() : null);

            if (root.has("triggerType")) {
                dsl.setTriggerType(TriggerType.valueOf(root.get("triggerType").asText()));
            }
            if (root.has("cronExpression")) {
                dsl.setCronExpression(root.get("cronExpression").asText());
            }

            if (root.has("variables")) {
                dsl.setVariables(parseVariables(root.get("variables")));
            }
            if (root.has("nodes")) {
                dsl.setNodes(parseNodes(root.get("nodes")));
            }
            if (root.has("transitions")) {
                dsl.setTransitions(parseTransitions(root.get("transitions")));
            }

            return dsl;
        } catch (DslParseException e) {
            throw e;
        } catch (IOException e) {
            throw new DslParseException("DSL parse failed: " + e.getMessage(), e);
        }
    }

    private List<VariableDefinition> parseVariables(JsonNode variablesNode) {
        List<VariableDefinition> variables = new ArrayList<>();
        for (JsonNode varNode : variablesNode) {
            VariableDefinition var = new VariableDefinition();
            var.setName(varNode.get("name").asText());
            var.setType(VariableType.valueOf(varNode.get("type").asText()));
            var.setRequired(varNode.has("required") && varNode.get("required").asBoolean());
            if (varNode.has("defaultValue")) {
                var.setDefaultValue(varNode.get("defaultValue").asText());
            }
            variables.add(var);
        }
        return variables;
    }

    private List<ProcessNode> parseNodes(JsonNode nodesNode) {
        List<ProcessNode> nodes = new ArrayList<>();
        for (JsonNode nodeNode : nodesNode) {
            ProcessNode node = new ProcessNode();
            node.setId(nodeNode.get("id").asText());
            node.setType(NodeType.valueOf(nodeNode.get("type").asText()));
            node.setName(nodeNode.get("name").asText());

            if (node.getType() == NodeType.GATEWAY && nodeNode.has("gatewayType")) {
                node.setGatewayType(GatewayType.valueOf(nodeNode.get("gatewayType").asText()));
                if (nodeNode.has("aiDecisionPrompt")) {
                    node.setAiDecisionPrompt(nodeNode.get("aiDecisionPrompt").asText());
                }
            }

            if (node.getType() == NodeType.TASK) {
                if (nodeNode.has("assignee")) {
                    node.setAssignee(parseAssignee(nodeNode.get("assignee")));
                }
                if (nodeNode.has("taskType")) {
                    node.setTaskType(TaskType.valueOf(nodeNode.get("taskType").asText()));
                }
                if (nodeNode.has("sla")) {
                    node.setSla(parseSla(nodeNode.get("sla")));
                }
                if (nodeNode.has("form")) {
                    node.setForm(parseForm(nodeNode.get("form")));
                }
            }

            if (nodeNode.has("action")) {
                node.setAction(parseAction(nodeNode.get("action")));
            }

            nodes.add(node);
        }
        return nodes;
    }

    private AssigneeConfig parseAssignee(JsonNode node) {
        AssigneeConfig config = new AssigneeConfig();
        config.setType(AssigneeType.valueOf(node.get("type").asText()));
        config.setValue(node.get("value").asText());
        return config;
    }

    private SlaConfig parseSla(JsonNode node) {
        SlaConfig config = new SlaConfig();
        config.setDuration(Duration.parse(node.get("duration").asText()));
        if (node.has("escalation")) {
            config.setEscalation(node.get("escalation").asText());
        }
        return config;
    }

    private FormConfig parseForm(JsonNode node) {
        FormConfig form = new FormConfig();
        if (node.has("fields")) {
            List<FormField> fields = new ArrayList<>();
            for (JsonNode fieldNode : node.get("fields")) {
                FormField field = new FormField();
                field.setCode(fieldNode.get("code").asText());
                field.setLabel(fieldNode.get("label").asText());
                field.setType(fieldNode.get("type").asText());
                field.setRequired(fieldNode.has("required") && fieldNode.get("required").asBoolean());
                if (fieldNode.has("options")) {
                    List<String> options = new ArrayList<>();
                    for (JsonNode opt : fieldNode.get("options")) {
                        options.add(opt.asText());
                    }
                    field.setOptions(options);
                }
                fields.add(field);
            }
            form.setFields(fields);
        }
        return form;
    }

    private NodeAction parseAction(JsonNode node) {
        NodeAction action = new NodeAction();
        action.setType(node.get("type").asText());
        if (node.has("variable")) action.setVariable(node.get("variable").asText());
        if (node.has("value")) action.setValue(node.get("value").asText());
        return action;
    }

    private List<Transition> parseTransitions(JsonNode transitionsNode) {
        List<Transition> transitions = new ArrayList<>();
        for (JsonNode transNode : transitionsNode) {
            Transition t = new Transition();
            t.setFrom(transNode.get("from").asText());
            t.setTo(transNode.get("to").asText());
            if (transNode.has("condition")) {
                t.setCondition(transNode.get("condition").asText());
            }
            transitions.add(t);
        }
        return transitions;
    }
}
