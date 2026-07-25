package com.metaplatform.wfe.engine.executor;

import com.metaplatform.wfe.engine.model.FlowNode;
import com.metaplatform.wfe.engine.model.NodeExecutionResult;
import com.metaplatform.wfe.entity.WfeActivityLogEntity;
import com.metaplatform.wfe.repository.WfeActivityLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * end 节点执行器：记录活动日志，标记流程完成。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EndNodeExecutor implements NodeExecutor {

    private final WfeActivityLogRepository activityLogRepository;

    @Override
    public String supportedType() {
        return "end";
    }

    @Override
    public NodeExecutionResult execute(FlowNode node, ExecutionContext context) {
        log.info("Process completed: processInstanceId={}, endNode={}", context.processInstanceId(), node.id());

        WfeActivityLogEntity entity = WfeActivityLogEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(context.tenantId())
                .processInstanceId(context.processInstanceId())
                .nodeId(node.id())
                .nodeType(node.type())
                .activityType("NODE_COMPLETED")
                .enteredAt(Instant.now())
                .build();
        activityLogRepository.save(entity);

        return NodeExecutionResult.completed();
    }
}
