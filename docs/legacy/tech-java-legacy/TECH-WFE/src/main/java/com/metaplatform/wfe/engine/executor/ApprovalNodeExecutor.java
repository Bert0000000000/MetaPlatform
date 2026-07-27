package com.metaplatform.wfe.engine.executor;

import com.metaplatform.wfe.engine.model.FlowNode;
import com.metaplatform.wfe.engine.model.NodeExecutionResult;
import com.metaplatform.wfe.engine.variable.VariableEngine;
import com.metaplatform.wfe.entity.WfeActivityLogEntity;
import com.metaplatform.wfe.entity.WfeTaskEntity;
import com.metaplatform.wfe.repository.WfeActivityLogRepository;
import com.metaplatform.wfe.repository.WfeTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * approval 节点执行器（核心）：创建审批任务并暂停流程，等待用户完成审批后推进。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ApprovalNodeExecutor implements NodeExecutor {

    private final VariableEngine variableEngine;
    private final WfeTaskRepository taskRepository;
    private final WfeActivityLogRepository activityLogRepository;

    @Override
    public String supportedType() {
        return "approval";
    }

    @Override
    public NodeExecutionResult execute(FlowNode node, ExecutionContext context) {
        String assigneeExpr = node.assignee();
        if (assigneeExpr == null && node.data() != null) {
            Object raw = node.data().get("assignee");
            assigneeExpr = raw != null ? String.valueOf(raw) : null;
        }

        String assignee = variableEngine.resolveAssignee(assigneeExpr, context.variables());
        log.info("Approval task created: processInstanceId={}, nodeId={}, assignee={}",
                context.processInstanceId(), node.id(), assignee);

        String taskId = UUID.randomUUID().toString();
        WfeTaskEntity task = WfeTaskEntity.builder()
                .id(taskId)
                .tenantId(context.tenantId())
                .processInstanceId(context.processInstanceId())
                .processDefinitionId(context.processDefinitionId())
                .nodeId(node.id())
                .name(node.title())
                .assignee(assignee)
                .status("ACTIVE")
                .build();
        taskRepository.save(task);

        WfeActivityLogEntity activityLog = WfeActivityLogEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(context.tenantId())
                .processInstanceId(context.processInstanceId())
                .nodeId(node.id())
                .nodeType(node.type())
                .activityType("TASK_CREATED")
                .assignee(assignee)
                .enteredAt(Instant.now())
                .build();
        activityLogRepository.save(activityLog);

        return NodeExecutionResult.waitForApproval(taskId);
    }
}
