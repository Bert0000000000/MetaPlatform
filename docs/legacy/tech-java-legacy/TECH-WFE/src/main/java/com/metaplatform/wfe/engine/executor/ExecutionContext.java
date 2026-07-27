package com.metaplatform.wfe.engine.executor;

import com.metaplatform.wfe.engine.model.FlowDocument;

import java.util.Collections;
import java.util.Map;

/**
 * 节点执行上下文。
 * 封装流程实例信息、流程变量、当前节点 ID 以及 FlowDocument（供执行器查找兄弟节点）。
 */
public class ExecutionContext {

    private final String processInstanceId;
    private final String tenantId;
    private final String startUserId;
    private final String processDefinitionId;
    private final Map<String, Object> variables;
    private final String currentNodeId;
    private final FlowDocument document;

    public ExecutionContext(String processInstanceId, String tenantId, String startUserId,
                            String processDefinitionId, Map<String, Object> variables,
                            String currentNodeId, FlowDocument document) {
        this.processInstanceId = processInstanceId;
        this.tenantId = tenantId;
        this.startUserId = startUserId;
        this.processDefinitionId = processDefinitionId;
        this.variables = variables != null ? variables : Collections.emptyMap();
        this.currentNodeId = currentNodeId;
        this.document = document;
    }

    public String processInstanceId() {
        return processInstanceId;
    }

    public String tenantId() {
        return tenantId;
    }

    public String startUserId() {
        return startUserId;
    }

    public String processDefinitionId() {
        return processDefinitionId;
    }

    public Map<String, Object> variables() {
        return variables;
    }

    public String currentNodeId() {
        return currentNodeId;
    }

    public FlowDocument document() {
        return document;
    }

    /**
     * 创建带新变量的上下文副本。
     */
    public ExecutionContext withVariables(Map<String, Object> newVariables) {
        return new ExecutionContext(processInstanceId, tenantId, startUserId,
                processDefinitionId, newVariables, currentNodeId, document);
    }

    /**
     * 创建带新当前节点 ID 的上下文副本。
     */
    public ExecutionContext withCurrentNodeId(String newCurrentNodeId) {
        return new ExecutionContext(processInstanceId, tenantId, startUserId,
                processDefinitionId, variables, newCurrentNodeId, document);
    }
}
