package com.metaplatform.process.application;

import com.metaplatform.process.domain.dsl.ProcessDsl;
import com.metaplatform.process.domain.dsl.ProcessNode;
import com.metaplatform.process.domain.dsl.Transition;
import com.metaplatform.process.domain.dsl.VariableDefinition;
import com.metaplatform.process.domain.enums.GatewayType;
import com.metaplatform.process.domain.enums.NodeType;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class DefinitionValidator {

    /**
     * Validate ProcessDsl legality
     */
    public ValidationResult validate(ProcessDsl dsl) {
        List<String> errors = new ArrayList<>();

        // 1. Must have exactly one START node
        long startCount = dsl.getNodes().stream()
            .filter(n -> n.getType() == NodeType.START).count();
        if (startCount != 1) {
            errors.add("Process must have exactly one START node, current: " + startCount);
        }

        // 2. Must have at least one END node
        long endCount = dsl.getNodes().stream()
            .filter(n -> n.getType() == NodeType.END).count();
        if (endCount < 1) {
            errors.add("Process must have at least one END node");
        }

        // 3. All transition from/to nodes must exist
        Set<String> nodeIds = dsl.getNodes().stream()
            .map(ProcessNode::getId).collect(Collectors.toSet());
        for (Transition t : dsl.getTransitions()) {
            if (!nodeIds.contains(t.getFrom())) {
                errors.add("Transition from node does not exist: " + t.getFrom());
            }
            if (!nodeIds.contains(t.getTo())) {
                errors.add("Transition to node does not exist: " + t.getTo());
            }
        }

        // 4. GATEWAY nodes must have at least 2 outgoing edges
        for (ProcessNode node : dsl.getNodes()) {
            if (node.getType() == NodeType.GATEWAY) {
                long outgoing = dsl.getTransitions().stream()
                    .filter(t -> t.getFrom().equals(node.getId())).count();
                if (outgoing < 2) {
                    errors.add("GATEWAY node '" + node.getId() + "' must have at least 2 outgoing edges");
                }
                // XOR gateway outgoing edges must have conditions
                if (node.getGatewayType() == GatewayType.XOR) {
                    List<Transition> outgoingTransitions = dsl.getTransitions().stream()
                        .filter(t -> t.getFrom().equals(node.getId()))
                        .toList();
                    for (Transition t : outgoingTransitions) {
                        if (t.getCondition() == null || t.getCondition().isBlank()) {
                            errors.add("XOR gateway '" + node.getId() +
                                "' outgoing edges must have condition expressions");
                        }
                    }
                }
            }
        }

        // 5. TASK nodes must have assignee
        for (ProcessNode node : dsl.getNodes()) {
            if (node.getType() == NodeType.TASK && node.getAssignee() == null) {
                errors.add("TASK node '" + node.getId() + "' must have assignee configured");
            }
        }

        // 6. START node cannot have incoming edges
        for (ProcessNode node : dsl.getNodes()) {
            if (node.getType() == NodeType.START) {
                long incoming = dsl.getTransitions().stream()
                    .filter(t -> t.getTo().equals(node.getId())).count();
                if (incoming > 0) {
                    errors.add("START node cannot have incoming edges");
                }
            }
        }

        // 7. END node cannot have outgoing edges
        for (ProcessNode node : dsl.getNodes()) {
            if (node.getType() == NodeType.END) {
                long outgoing = dsl.getTransitions().stream()
                    .filter(t -> t.getFrom().equals(node.getId())).count();
                if (outgoing > 0) {
                    errors.add("END node cannot have outgoing edges");
                }
            }
        }

        // 8. Variable reference validity
        Set<String> varNames = dsl.getVariables() != null ?
            dsl.getVariables().stream()
                .map(VariableDefinition::getName)
                .collect(Collectors.toSet()) : Set.of();

        for (Transition t : dsl.getTransitions()) {
            if (t.getCondition() != null) {
                List<String> refs = extractVariableReferences(t.getCondition());
                for (String ref : refs) {
                    if (!varNames.contains(ref)) {
                        errors.add("Condition references undeclared variable: " + ref);
                    }
                }
            }
        }

        return new ValidationResult(errors.isEmpty(), errors);
    }

    private List<String> extractVariableReferences(String expression) {
        List<String> refs = new ArrayList<>();
        Pattern pattern = Pattern.compile("getVariable\\('([^']+)'\\)");
        Matcher matcher = pattern.matcher(expression);
        while (matcher.find()) {
            refs.add(matcher.group(1));
        }
        return refs;
    }
}
