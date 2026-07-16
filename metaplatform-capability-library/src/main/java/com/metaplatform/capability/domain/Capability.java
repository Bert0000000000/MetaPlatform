package com.metaplatform.capability.domain;

/**
 * 能力接口。所有可执行能力的抽象。
 * 每个能力都有唯一的名称、类型和执行方法。
 */
public interface Capability {

    /**
     * 能力的唯一名称。
     */
    String name();

    /**
     * 能力描述。
     */
    String description();

    /**
     * 能力分类类型。
     */
    CapabilityType type();

    /**
     * 执行能力。
     *
     * @param context 执行上下文，包含输入参数
     * @return 执行结果
     */
    CapabilityResult execute(CapabilityContext context);

    /**
     * 是否为异步能力（v0.1 全部同步执行）。
     */
    default boolean isAsync() {
        return false;
    }
}
