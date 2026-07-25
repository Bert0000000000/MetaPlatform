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
 * if 节点执行器（二路条件）：求值 condition，true 进入 ifBlock，false 进入 elseBlock。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IfNodeExecutor implements NodeExecutor {

    private final VariableEngine variableEngine;
    private final WfeActivityLogRepository activityLogRepository;

    @Override
    public String supportedType() {
        return "if";
    }

    @Override
    public NodeExecutionResult execute(FlowNode node, ExecutionContext context) {
        log.info("If condition evaluating: processInstanceId={}, nodeId={}",
                context.processInstanceId(), node.id());

        Object conditionValue = extractAndResolveCondition(node, context.variables());
        boolean conditionResult = variableEngine.evaluateCondition(conditionValue, context.variables());

        logActivity(context, node, "GATEWAY_EVALUATED", String.valueOf(conditionResult));

        String nextNodeId = null;
        List<FlowNode> blocks = node.blocks();
        if (blocks != null) {
            String trueBlockType = conditionResult ? "ifBlock" : "elseBlock";
            String fallbackBlockType = conditionResult ? "trueBlock" : "falseBlock";
            for (FlowNode block : blocks) {
                if (trueBlockType.equals(block.type()) || fallbackBlockType.equals(block.type())) {
                    nextNodeId = getFirstChildId(block);
                    break;
                }
            }
        }

        if (nextNodeId == null) {
            return NodeExecutionResult.error("if 节点 " + node.id() + " 未找到对应分支 block");
        }
        return NodeExecutionResult.continueTo(nextNodeId);
    }

    private Object extractAndResolveCondition(FlowNode ifNode, Map<String, Object> variables) {
        if (ifNode.data() == null) {
            return null;
        }
        Object inputsValues = ifNode.data().get("inputsValues");
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
