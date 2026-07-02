package com.metaplatform.process.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.metaplatform.process.domain.dsl.ProcessDsl;
import com.metaplatform.process.domain.dsl.ProcessNode;
import com.metaplatform.process.domain.dsl.Transition;
import com.metaplatform.process.domain.enums.GatewayType;
import com.metaplatform.process.domain.enums.NodeType;
import com.metaplatform.process.infrastructure.exception.DslParseException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DslParserTest {

    private DslParser parser;

    @BeforeEach
    void setUp() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        parser = new DslParser(mapper);
    }

    @Test
    void parseSimpleDsl() {
        String dslJson = """
            {
              "key": "test_flow",
              "name": "Test Flow",
              "description": "A test flow",
              "variables": [
                {"name": "amount", "type": "DECIMAL", "required": true}
              ],
              "nodes": [
                {"id": "start", "type": "START", "name": "Start"},
                {"id": "end", "type": "END", "name": "End"}
              ],
              "transitions": [
                {"from": "start", "to": "end"}
              ]
            }
            """;

        ProcessDsl dsl = parser.parse(dslJson);

        assertNotNull(dsl);
        assertEquals("test_flow", dsl.getKey());
        assertEquals("Test Flow", dsl.getName());
        assertEquals("A test flow", dsl.getDescription());
        assertEquals(1, dsl.getVariables().size());
        assertEquals("amount", dsl.getVariables().get(0).getName());
        assertEquals(2, dsl.getNodes().size());
        assertEquals(1, dsl.getTransitions().size());
    }

    @Test
    void parseDslWithGateway() {
        String dslJson = """
            {
              "key": "approval_flow",
              "name": "Approval Flow",
              "variables": [
                {"name": "amount", "type": "DECIMAL", "required": true}
              ],
              "nodes": [
                {"id": "start", "type": "START", "name": "Start"},
                {"id": "check", "type": "GATEWAY", "name": "Amount Check", "gatewayType": "XOR"},
                {"id": "approve", "type": "TASK", "name": "Approve",
                 "assignee": {"type": "USER", "value": "manager01"},
                 "taskType": "APPROVAL",
                 "sla": {"duration": "PT24H", "escalation": "NOTIFY"}},
                {"id": "end_ok", "type": "END", "name": "End OK",
                 "action": {"type": "SET_VARIABLE", "variable": "status", "value": "APPROVED"}},
                {"id": "end_auto", "type": "END", "name": "Auto Approve"}
              ],
              "transitions": [
                {"from": "start", "to": "check"},
                {"from": "check", "to": "end_auto", "condition": "getVariable('amount') < 10000"},
                {"from": "check", "to": "approve", "condition": "getVariable('amount') >= 10000"},
                {"from": "approve", "to": "end_ok"}
              ]
            }
            """;

        ProcessDsl dsl = parser.parse(dslJson);

        assertNotNull(dsl);
        assertEquals(5, dsl.getNodes().size());
        assertEquals(4, dsl.getTransitions().size());

        // Check gateway
        ProcessNode gateway = dsl.getNodeById("check");
        assertEquals(NodeType.GATEWAY, gateway.getType());
        assertEquals(GatewayType.XOR, gateway.getGatewayType());

        // Check task node
        ProcessNode task = dsl.getNodeById("approve");
        assertEquals(NodeType.TASK, task.getType());
        assertNotNull(task.getAssignee());
        assertNotNull(task.getSla());

        // Check start node
        ProcessNode start = dsl.getStartNode();
        assertEquals("start", start.getId());

        // Check outgoing transitions
        var checkOutgoing = dsl.getOutgoingTransitions("check");
        assertEquals(2, checkOutgoing.size());
    }

    @Test
    void parseInvalidJsonThrowsException() {
        String invalidJson = "not valid json";
        assertThrows(DslParseException.class, () -> parser.parse(invalidJson));
    }

    @Test
    void parseMissingKeyThrowsException() {
        String dslJson = """
            {
              "name": "Test"
            }
            """;
        assertThrows(Exception.class, () -> parser.parse(dslJson));
    }

    @Test
    void parseDslWithFormConfig() {
        String dslJson = """
            {
              "key": "form_flow",
              "name": "Form Flow",
              "nodes": [
                {"id": "start", "type": "START", "name": "Start"},
                {"id": "task1", "type": "TASK", "name": "Fill Form",
                 "assignee": {"type": "USER", "value": "user01"},
                 "taskType": "MANUAL",
                 "form": {
                   "fields": [
                     {"code": "comment", "label": "Comment", "type": "TEXTAREA", "required": true},
                     {"code": "decision", "label": "Decision", "type": "SELECT", "options": ["YES", "NO"]}
                   ]
                 }},
                {"id": "end", "type": "END", "name": "End"}
              ],
              "transitions": [
                {"from": "start", "to": "task1"},
                {"from": "task1", "to": "end"}
              ]
            }
            """;

        ProcessDsl dsl = parser.parse(dslJson);
        ProcessNode taskNode = dsl.getNodeById("task1");

        assertNotNull(taskNode.getForm());
        assertEquals(2, taskNode.getForm().getFields().size());
        assertEquals("comment", taskNode.getForm().getFields().get(0).getCode());
        assertTrue(taskNode.getForm().getFields().get(0).isRequired());
        assertEquals(2, taskNode.getForm().getFields().get(1).getOptions().size());
    }
}
