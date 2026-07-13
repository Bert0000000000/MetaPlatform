package com.metaplatform.appservice.domain.workflow;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BpmnXmlParserTest {

    @Test
    void extractProcessKeyFromNamespacedBpmn() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:flowable="http://flowable.org/bpmn"
                  xmlns:mp="http://metaplatform.org/bpmn"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
                  <bpmn:process id="m3e2eProcess" name="M3 E2E Process" isExecutable="true">
                    <bpmn:startEvent id="start_1" name="Start" />
                    <bpmn:userTask id="approval_1" name="Approval" flowable:candidateGroups="managers">
                      <bpmn:extensionElements>
                        <mp:fieldPermissions>[{"key":"amount","permission":"readonly"}]</mp:fieldPermissions>
                      </bpmn:extensionElements>
                    </bpmn:userTask>
                  </bpmn:process>
                </definitions>
                """;
        String key = BpmnXmlParser.extractProcessKey(xml);
        assertEquals("m3e2eProcess", key);
    }
}
