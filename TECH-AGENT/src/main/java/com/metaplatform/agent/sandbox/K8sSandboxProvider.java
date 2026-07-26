package com.metaplatform.agent.sandbox;

import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.PodBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Kubernetes Sandbox Provider（P3.2.3）。
 *
 * <p>每 Thread 启动一个独立 Pod 用于代码 / 文件 / 浏览器等不可信执行环境。
 * 关键安全约束：</p>
 *
 * <ul>
 *   <li>非 root（runAsUser: 1000）</li>
 *   <li>只读 root 文件系统</li>
 *   <li>CPU / Memory 限制</li>
 *   <li>出网白名单（NetworkPolicy，由集群侧强制）</li>
 *   <li>执行超时自动 kill</li>
 *   <li>任务结束自动销毁</li>
 * </ul>
 */
@Slf4j
@Component
public class K8sSandboxProvider implements SandboxProvider {

    @Value("${mate.sandbox.k8s.namespace:metaplatform-sandbox}")
    private String namespace;

    @Value("${mate.sandbox.k8s.image:metaplatform/sandbox-runtime:1.0}")
    private String defaultImage;

    private KubernetesClient k8s;
    private final Map<String, SandboxHandle> handles = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        try {
            k8s = new KubernetesClientBuilder().build();
            log.info("[K8sSandboxProvider] connected namespace={}", namespace);
        } catch (Exception e) {
            log.warn("[K8sSandboxProvider] 连接失败，P3.2 阶段以降级模式运行: {}", e.getMessage());
        }
    }

    @PreDestroy
    public void destroy() {
        if (k8s != null) k8s.close();
    }

    @Override
    public SandboxHandle prepare(String tenantId, String threadId, SandboxConfig config) {
        String handleId = "SB-" + UUID.randomUUID().toString().substring(0, 8);
        String podName = "sandbox-" + threadId.toLowerCase() + "-" + handleId.toLowerCase();
        Instant now = Instant.now();
        Instant expires = now.plusSeconds(config == null ? 3600 : config.getTimeoutSeconds());

        SandboxHandle handle = SandboxHandle.builder()
                .handleId(handleId)
                .podName(podName)
                .tenantId(tenantId)
                .threadId(threadId)
                .workspacePath("/mnt/user-data")
                .createdAt(now)
                .expiresAt(expires)
                .status("PENDING")
                .build();
        handles.put(handleId, handle);

        if (k8s == null) {
            log.warn("[K8sSandboxProvider] K8s 未连接，返回占位 handle");
            handle.setStatus("READY");
            return handle;
        }

        try {
            Pod pod = new PodBuilder()
                    .withNewMetadata().withName(podName).withNamespace(namespace).addToLabels("app", "sandbox")
                            .addToLabels("tenant", tenantId).addToLabels("thread", threadId)
                            .addToLabels("handle", handleId).endMetadata()
                    .withNewSpec()
                        .withRestartPolicy("Never")
                        .withActiveDeadlineSeconds((long) (config == null ? 3600 : config.getTimeoutSeconds()))
                        .addNewContainer()
                            .withName("runtime")
                            .withImage(config == null || config.getImage() == null ? defaultImage : config.getImage())
                            .withImagePullPolicy("IfNotPresent")
                            .withCommand(List.of("/bin/sh", "-c", "sleep infinity"))
                            .withNewResources()
                                .addToLimits("cpu", (config == null ? 1000 : config.getCpuMilli()) + "m")
                                .addToLimits("memory", (config == null ? 2048 : config.getMemoryMb()) + "Mi")
                                .addToRequests("cpu", "100m")
                                .addToRequests("memory", "128Mi")
                            .endResources()
                            .withNewSecurityContext()
                                .withRunAsUser(1000L)
                                .withRunAsNonRoot(true)
                                .withReadOnlyRootFilesystem(config == null || config.isReadOnlyRoot())
                                .withAllowPrivilegeEscalation(false)
                                .withCapabilities(new io.fabric8.kubernetes.api.model.CapabilitiesBuilder()
                                        .withDrop(List.of("ALL")).build())
                            .endSecurityContext()
                            .addNewVolumeMount().withName("user-data").withMountPath("/mnt/user-data").endVolumeMount()
                        .endContainer()
                        .addNewVolume()
                            .withName("user-data")
                            .withNewEmptyDir().withSizeLimit((config == null ? 10 : config.getDiskMb()) + "Mi").endEmptyDir()
                        .endVolume()
                    .endSpec()
                    .build();
            k8s.pods().inNamespace(namespace).resource(pod).create();
            log.info("[K8sSandboxProvider] pod created name={} ns={}", podName, namespace);
            handle.setStatus("READY");
        } catch (Exception e) {
            log.error("[K8sSandboxProvider] pod create failed", e);
            handle.setStatus("FAILED");
        }
        return handle;
    }

    @Override
    public void destroy(String handleId) {
        SandboxHandle handle = handles.remove(handleId);
        if (handle == null) return;
        if (k8s != null) {
            try {
                k8s.pods().inNamespace(namespace).withName(handle.getPodName()).delete();
            } catch (Exception e) {
                log.warn("[K8sSandboxProvider] delete pod failed", e);
            }
        }
        handle.setStatus("DESTROYED");
        log.info("[K8sSandboxProvider] destroyed handleId={}", handleId);
    }

    @Override
    public SandboxResult exec(String handleId, String command, int timeoutSeconds) {
        // P3.2 占位：实际通过 k8s exec API 在 Pod 内执行
        // 需要：k8sClient.pods().inNamespace(ns).withName(podName).inContainer("runtime")
        //        .writingOutput(new ByteArrayOutputStream()).exec(command)
        log.warn("[K8sSandboxProvider] exec 占位实现 handleId={} command={}", handleId, command);
        return SandboxResult.builder()
                .exitCode(0)
                .stdout("P3.2 占位实现，需要在 Phase 5.1 接通 k8s exec")
                .stderr("")
                .durationMs(0)
                .timedOut(false)
                .build();
    }

    @Override
    public void writeFile(String handleId, String path, String content) {
        // P3.2 占位：通过 kubectl cp 或 k8s exec 写入
        log.info("[K8sSandboxProvider] writeFile handleId={} path={} bytes={}",
                handleId, path, content == null ? 0 : content.length());
    }

    /**
     * 健康检查。
     */
    public boolean isHealthy() {
        return k8s != null && k8s.pods() != null;
    }
}
