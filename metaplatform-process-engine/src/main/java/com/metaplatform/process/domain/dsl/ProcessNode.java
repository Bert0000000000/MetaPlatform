package com.metaplatform.process.domain.dsl;

import com.metaplatform.process.domain.enums.GatewayType;
import com.metaplatform.process.domain.enums.NodeType;
import com.metaplatform.process.domain.enums.TaskType;

public class ProcessNode {
    private String id;
    private NodeType type;
    private String name;
    private GatewayType gatewayType;
    private AssigneeConfig assignee;
    private TaskType taskType;
    private SlaConfig sla;
    private FormConfig form;
    private NodeAction action;

    public ProcessNode() {}

    public ProcessNode(String id, NodeType type, String name) {
        this.id = id;
        this.type = type;
        this.name = name;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public NodeType getType() { return type; }
    public void setType(NodeType type) { this.type = type; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public GatewayType getGatewayType() { return gatewayType; }
    public void setGatewayType(GatewayType gatewayType) { this.gatewayType = gatewayType; }
    public AssigneeConfig getAssignee() { return assignee; }
    public void setAssignee(AssigneeConfig assignee) { this.assignee = assignee; }
    public TaskType getTaskType() { return taskType; }
    public void setTaskType(TaskType taskType) { this.taskType = taskType; }
    public SlaConfig getSla() { return sla; }
    public void setSla(SlaConfig sla) { this.sla = sla; }
    public FormConfig getForm() { return form; }
    public void setForm(FormConfig form) { this.form = form; }
    public NodeAction getAction() { return action; }
    public void setAction(NodeAction action) { this.action = action; }
}
