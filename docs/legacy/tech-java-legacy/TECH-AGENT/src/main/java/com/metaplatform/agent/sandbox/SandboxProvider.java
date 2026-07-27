package com.metaplatform.agent.sandbox;

/**
 * Sandbox Provider SPI（P3.2.3）。
 *
 * <p>每 Thread 启动一个独立 Pod / 容器用于执行不可信代码。
 * P3.2 提供 K8s Provider；后续 P8.1 可插入本地 Provider。</p>
 */
public interface SandboxProvider {

    /**
     * 为 Thread 准备 Sandbox（启动 Pod 并返回 connection 信息）。
     */
    SandboxHandle prepare(String tenantId, String threadId, SandboxConfig config);

    /**
     * 销毁 Sandbox（删除 Pod）。
     */
    void destroy(String handleId);

    /**
     * 在 Sandbox 中执行命令。
     */
    SandboxResult exec(String handleId, String command, int timeoutSeconds);

    /**
     * 写入文件到 Sandbox 工作区。
     */
    void writeFile(String handleId, String path, String content);
}
