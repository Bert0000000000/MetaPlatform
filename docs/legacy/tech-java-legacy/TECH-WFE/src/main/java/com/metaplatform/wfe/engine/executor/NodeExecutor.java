package com.metaplatform.wfe.engine.executor;

import com.metaplatform.wfe.engine.model.FlowNode;
import com.metaplatform.wfe.engine.model.NodeExecutionResult;

/**
 * 节点执行器接口。
 * 每种 FlowGram 节点类型对应一个实现，由 Spring 自动注入到 WfeStateMachineEngine。
 */
public interface NodeExecutor {

    /**
     * 该执行器支持的节点类型。
     */
    String supportedType();

    /**
     * 执行节点逻辑。
     *
     * @param node    当前 FlowGram 节点
     * @param context 执行上下文（包含流程变量、FlowDocument 等）
     * @return 节点执行结果，驱动状态机推进
     */
    NodeExecutionResult execute(FlowNode node, ExecutionContext context);
}
