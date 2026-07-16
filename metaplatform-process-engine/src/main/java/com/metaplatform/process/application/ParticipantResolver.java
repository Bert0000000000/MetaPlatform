package com.metaplatform.process.application;

import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.dsl.AssigneeConfig;
import com.metaplatform.process.domain.enums.AssigneeType;
import com.metaplatform.process.infrastructure.exception.ParticipantResolutionException;
import com.metaplatform.process.infrastructure.util.JsonUtils;
import com.googlecode.aviator.AviatorEvaluator;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class ParticipantResolver {

    /**
     * Resolve participant based on AssigneeConfig
     */
    public String resolve(AssigneeConfig config, ProcessInstance instance) {
        if (config == null) {
            throw new ParticipantResolutionException("AssigneeConfig is null");
        }
        return switch (config.getType()) {
            case USER -> resolveUser(config.getValue());
            case ROLE -> resolveRole(config.getValue());
            case EXPRESSION -> resolveExpression(config.getValue(), instance);
        };
    }

    /**
     * Direct user ID assignment
     */
    private String resolveUser(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ParticipantResolutionException("User ID is empty");
        }
        return userId;
    }

    /**
     * Role-based resolution (returns role name as placeholder for v0.1)
     */
    private String resolveRole(String roleName) {
        if (roleName == null || roleName.isBlank()) {
            throw new ParticipantResolutionException("Role name is empty");
        }
        // v0.1: returns the role name, actual user resolution by role
        // would require integration with user service
        return roleName;
    }

    /**
     * Aviator expression resolution
     */
    private String resolveExpression(String expression, ProcessInstance instance) {
        if (expression == null || expression.isBlank()) {
            throw new ParticipantResolutionException("Expression is empty");
        }

        Map<String, Object> env = new HashMap<>();
        env.put("initiatorId", instance.getInitiatorId());

        // Add process variables
        Map<String, Object> variables = JsonUtils.fromJson(instance.getVariablesJson(), Map.class);
        if (variables != null) {
            env.putAll(variables);
        }

        try {
            // Handle getVariable('xxx') style
            String processed = expression;
            if (variables != null) {
                for (Map.Entry<String, Object> entry : variables.entrySet()) {
                    processed = processed.replace(
                        "getVariable('" + entry.getKey() + "')",
                        entry.getValue() instanceof String ?
                            "'" + entry.getValue() + "'" : String.valueOf(entry.getValue()));
                }
            }
            processed = processed.replace("getInitiator()",
                "'" + instance.getInitiatorId() + "'");

            Object result = AviatorEvaluator.execute(processed, env, true);
            if (result == null) {
                throw new ParticipantResolutionException(
                    "Expression returned null: " + expression);
            }
            return result.toString();
        } catch (Exception e) {
            if (e instanceof ParticipantResolutionException) throw e;
            throw new ParticipantResolutionException(
                "Expression evaluation failed: " + expression + " - " + e.getMessage(), e);
        }
    }
}
