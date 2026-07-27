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
 * loop 节点执行器（简化版）：记录日志，跳过循环体，继续下一兄弟节点。
 * 循环体执行留待后续实现。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LoopNodeExecutor implements NodeExecutor {

    private final FlowGramParser flowGramParser;
    private final WfeActivityLogRepository activityLogRepository;

    @Override
    public String supportedType() {
        return "loop";
    }

    @Override
    public NodeExecutionResult execute(FlowNode node, ExecutionContext context) {
        log.info("Loop node encountered (simplified, body skipped): processInstanceId={}, nodeId={}",
                context.processInstanceId(), node.id());

        WfeActivityLogEntity entity = WfeActivityLogEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(context.tenantId())
                .processInstanceId(context.processInstanceId())
                .nodeId(node.id())
                .nodeType(node.type())
                .activityType("NODE_STARTED")
                .enteredAt(Instant.now())
                .build();
        activityLogRepository.save(entity);

        FlowNode nextSibling = flowGramParser.findNextSibling(context.document(), node.id());
        if (nextSibling == null) {
            return NodeExecutionResult.error("loop 节点后无后续节点");
        }
        return NodeExecutionResult.continueTo(nextSibling.id());
    }
}
