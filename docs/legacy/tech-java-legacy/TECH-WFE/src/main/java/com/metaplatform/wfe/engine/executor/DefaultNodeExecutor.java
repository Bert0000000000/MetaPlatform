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
 * 兜底节点执行器：处理未识别的节点类型，记录日志并推进到下一节点。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DefaultNodeExecutor implements NodeExecutor {

    private final FlowGramParser flowGramParser;
    private final WfeActivityLogRepository activityLogRepository;

    @Override
    public String supportedType() {
        return "default";
    }

    @Override
    public NodeExecutionResult execute(FlowNode node, ExecutionContext context) {
        log.info("Default executor handling node: processInstanceId={}, nodeId={}, nodeType={}",
                context.processInstanceId(), node.id(), node.type());

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
            return NodeExecutionResult.error("节点 " + node.id() + " 后无后续节点");
        }
        return NodeExecutionResult.continueTo(nextSibling.id());
    }
}
