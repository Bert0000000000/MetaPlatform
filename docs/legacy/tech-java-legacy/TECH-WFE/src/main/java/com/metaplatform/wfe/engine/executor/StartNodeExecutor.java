package com.metaplatform.wfe.engine.executor;

import com.metaplatform.wfe.engine.model.FlowNode;
import com.metaplatform.wfe.engine.model.NodeExecutionResult;
import com.metaplatform.wfe.engine.parser.FlowGramParser;
import com.metaplatform.wfe.entity.WfeActivityLogEntity;
import com.metaplatform.wfe.repository.WfeActivityLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * start 节点执行器：记录活动日志，推进到下一节点。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StartNodeExecutor implements NodeExecutor {

    private final FlowGramParser flowGramParser;
    private final WfeActivityLogRepository activityLogRepository;

    @Override
    public String supportedType() {
        return "start";
    }

    @Override
    public NodeExecutionResult execute(FlowNode node, ExecutionContext context) {
        log.info("Process started: processInstanceId={}, startNode={}", context.processInstanceId(), node.id());

        logActivity(context, node, "NODE_STARTED", null);

        FlowNode nextSibling = flowGramParser.findNextSibling(context.document(), node.id());
        if (nextSibling == null) {
            return NodeExecutionResult.error("start 节点后无后续节点");
        }
        return NodeExecutionResult.continueTo(nextSibling.id());
    }

    private void logActivity(ExecutionContext context, FlowNode node, String activityType, String assignee) {
        WfeActivityLogEntity entity = WfeActivityLogEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(context.tenantId())
                .processInstanceId(context.processInstanceId())
                .nodeId(node.id())
                .nodeType(node.type())
                .activityType(activityType)
                .assignee(assignee)
                .enteredAt(Instant.now())
                .build();
        activityLogRepository.save(entity);
    }
}
