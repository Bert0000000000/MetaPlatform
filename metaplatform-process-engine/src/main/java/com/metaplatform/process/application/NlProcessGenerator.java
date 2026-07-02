package com.metaplatform.process.application;

import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.dsl.ProcessDsl;
import com.metaplatform.process.domain.enums.DefinitionStatus;
import com.metaplatform.process.infrastructure.exception.NlGenerationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NlProcessGenerator {

    private final DslParser dslParser;
    private final DefinitionValidator validator;

    public NlProcessGenerator(DslParser dslParser, DefinitionValidator validator) {
        this.dslParser = dslParser;
        this.validator = validator;
    }

    /**
     * Generate process definition from natural language description.
     * v0.1: Uses template-based generation; v0.2 will integrate AI Substrate LLM.
     */
    public ProcessDefinition generate(String description) {
        if (description == null || description.isBlank()) {
            throw new NlGenerationException("Description cannot be empty");
        }

        // v0.1: Template-based DSL generation
        // In production, this would call AI Substrate's LlmGateway
        String dslJson = generateTemplateDsl(description);

        // Parse DSL
        ProcessDsl dsl;
        try {
            dsl = dslParser.parse(dslJson);
        } catch (Exception e) {
            throw new NlGenerationException("Generated DSL parse failed: " + e.getMessage(), e);
        }

        // Validate
        ValidationResult result = validator.validate(dsl);
        if (!result.isValid()) {
            throw new NlGenerationException(
                "Generated DSL is invalid: " + String.join("; ", result.getErrors()));
        }

        // Build ProcessDefinition
        ProcessDefinition definition = new ProcessDefinition();
        definition.setName(dsl.getName());
        definition.setCode(dsl.getKey());
        definition.setDescription(dsl.getDescription());
        definition.setVersion(1);
        definition.setStatus(DefinitionStatus.DRAFT);
        definition.setDslJson(dslJson);
        definition.setCreatedBy("nl_generator");
        definition.setCreatedAt(LocalDateTime.now());
        definition.setUpdatedAt(LocalDateTime.now());

        return definition;
    }

    /**
     * v0.1 template-based DSL generation from natural language.
     * This generates a simple approval workflow based on keywords.
     */
    private String generateTemplateDsl(String description) {
        String lowerDesc = description.toLowerCase();
        String key = "nl_generated_" + System.currentTimeMillis();

        // Simple keyword-based generation
        if (lowerDesc.contains("approval") || lowerDesc.contains("approve") ||
            lowerDesc.contains("review") || lowerDesc.contains("approve")) {
            return String.format("""
                {
                  "key": "%s",
                  "name": "NL Generated Approval Process",
                  "description": "%s",
                  "variables": [
                    {"name": "amount", "type": "DECIMAL", "required": true}
                  ],
                  "nodes": [
                    {"id": "start", "type": "START", "name": "Start"},
                    {"id": "check", "type": "GATEWAY", "name": "Amount Check", "gatewayType": "XOR"},
                    {"id": "auto_approve", "type": "END", "name": "Auto Approve",
                     "action": {"type": "SET_VARIABLE", "variable": "status", "value": "APPROVED"}},
                    {"id": "manual_approve", "type": "TASK", "name": "Manual Approval",
                     "assignee": {"type": "EXPRESSION", "value": "getInitiator()"},
                     "taskType": "APPROVAL"},
                    {"id": "end_approved", "type": "END", "name": "Approved",
                     "action": {"type": "SET_VARIABLE", "variable": "status", "value": "APPROVED"}},
                    {"id": "end_rejected", "type": "END", "name": "Rejected",
                     "action": {"type": "SET_VARIABLE", "variable": "status", "value": "REJECTED"}}
                  ],
                  "transitions": [
                    {"from": "start", "to": "check"},
                    {"from": "check", "to": "auto_approve", "condition": "getVariable('amount') < 10000"},
                    {"from": "check", "to": "manual_approve", "condition": "getVariable('amount') >= 10000"},
                    {"from": "manual_approve", "to": "end_approved", "condition": "taskResult == 'APPROVE'"},
                    {"from": "manual_approve", "to": "end_rejected", "condition": "taskResult == 'REJECT'"}
                  ]
                }
                """, key, escapeJson(description));
        }

        // Default: simple sequential process
        return String.format("""
            {
              "key": "%s",
              "name": "NL Generated Process",
              "description": "%s",
              "variables": [],
              "nodes": [
                {"id": "start", "type": "START", "name": "Start"},
                {"id": "task1", "type": "TASK", "name": "Process Task",
                 "assignee": {"type": "EXPRESSION", "value": "getInitiator()"},
                 "taskType": "MANUAL"},
                {"id": "end", "type": "END", "name": "End"}
              ],
              "transitions": [
                {"from": "start", "to": "task1"},
                {"from": "task1", "to": "end"}
              ]
            }
            """, key, escapeJson(description));
    }

    private String escapeJson(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
