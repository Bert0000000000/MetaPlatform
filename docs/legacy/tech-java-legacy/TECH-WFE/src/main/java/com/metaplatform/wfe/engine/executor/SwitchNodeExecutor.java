package com.metaplatform.wfe.engine.executor;

import com.metaplatform.wfe.engine.model.FlowNode;
import com.metaplatform.wfe.engine.model.FlowValue;
import com.metaplatform.wfe.engine.model.NodeExecutionResult;
import com.metaplatform.wfe.engine.variable.VariableEngine;
import com.metaplatform.wfe.entity.WfeActivityLogEntity;
import com.metaplatform.wfe.repository.WfeActivityLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.time.Instant;
import java.util.UUID;

/**
 * switch 节点执行器（排他网关）：遍历 case 子节点，选择第一个条件为 true 的分支。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SwitchNodeExecutor implements NodeExecutor {

    private final VariableEngine variableEngine;
    private final WfeActivityLogRepository activityLogRepository;

    @Override
    public String supportedType() {
        return "switch";
    }

    @Override
    public NodeExecutionResult execute(FlowNode node, ExecutionContext context) {
        log.info("Switch gateway evaluating: processInstanceId={}, nodeId={}",
                context.processInstanceId(), node.id());

        String selectedNodeId = null;
        String selectedCaseId = null;

        List<FlowNode> blocks = node.blocks();
        if (blocks != null) {
            for (FlowNode block : blocks) {
                if ("case".equals(block.type())) {
                    Object conditionValue = extractAndResolveCondition(block, context.variables());
                    if (variableEngine.evaluateCondition(conditionValue, context.variables())) {
                        selectedCaseId = block.id();
                        selectedNodeId = getFirstChildId(block);
                        break;
                    }
                }
            }

            if (selectedNodeId == null) {
                for (FlowNode block : blocks) {
                    if ("caseDefault".equals(block.type())) {
                        selectedCaseId = block.id();
                        selectedNodeId = getFirstChildId(block);
                        break;
                    }
                }
            }
        }

        logActivity(context, node, "GATEWAY_EVALUATED", selectedCaseId);

        if (selectedNodeId == null) {
            return NodeExecutionResult.error("switch 节点 " + node.id() + " 无匹配 case 且无 caseDefault");
        }
        return NodeExecutionResult.continueTo(selectedNodeId);
    }

    private Object extractAndResolveCondition(FlowNode caseNode, Map<String, Object> variables) {
        if (caseNode.data() == null) {
            return null;
        }
        Object inputsValues = caseNode.data().get("inputsValues");
        if (!(inputsValues instanceof Map<?, ?> ivMap)) {
            return null;
        }
        Object condition = ivMap.get("condition");
        if (condition == null) {
            return null;
        }
        if (condition instanceof Map<?, ?> cvMap && cvMap.containsKey("type")) {
            FlowValue fv = new FlowValue((String) cvMap.get("type"), cvMap.get("content"));
            return variableEngine.resolve(fv, variables);
        }
        return condition;
    }

    private String getFirstChildId(FlowNode block) {
        if (block.blocks() != null && !block.blocks().isEmpty()) {
            return block.blocks().get(0).id();
        }
        return null;
    }

    private void logActivity(ExecutionContext context, FlowNode node, String activityType, String detail) {
        WfeActivityLogEntity entity = WfeActivityLogEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(context.tenantId())
                .processInstanceId(context.processInstanceId())
                .nodeId(node.id())
                .nodeType(node.type())
                .activityType(activityType)
                .assignee(detail)
                .enteredAt(Instant.now())
                .build();
        activityLogRepository.save(entity);
    }
}
