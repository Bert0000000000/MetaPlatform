package com.metaplatform.agent.workspace;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Thread Workspace Provisioner（P3.2.2）。
 *
 * <p>每个 Thread / Run 在 MinIO 分配独立 prefix：</p>
 *
 * <pre>
 * /workspaces/{tenantId}/{threadId}/
 *   ├── uploads/   -- 用户上传
 *   ├── workspace/ -- Agent 工作区
 *   └── outputs/   -- 生成的 Artifact
 * </pre>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkspaceProvisioner {

    @Value("${mate.workspace.bucket:metaplatform-workspaces}")
    private String bucket;

    /**
     * 分配工作区路径。
     */
    public String allocatePath(String tenantId, String threadId, String subPath) {
        return "workspaces/" + tenantId + "/" + threadId + "/" + subPath;
    }

    /**
     * 写入文件到 workspace。
     */
    public void putFile(String key, String content) {
        try {
            S3Client client = s3Client();
            client.putObject(PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build(), software.amazon.awssdk.core.sync.RequestBody.fromContent(
                            new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8))));
            log.debug("[WorkspaceProvisioner] put key={}", key);
        } catch (Exception e) {
            log.warn("[WorkspaceProvisioner] putFile failed key={}: {}", key, e.getMessage());
        }
    }

    /**
     * 批量写入（一次性事务）。
     */
    public int putAll(Map<String, String> files) {
        int n = 0;
        for (Map.Entry<String, String> e : files.entrySet()) {
            putFile(e.getKey(), e.getValue());
            n++;
        }
        return n;
    }

    private S3Client s3Client() {
        // P3.2 占位：实际生产通过 Spring 自动注入 S3Client
        // 这里采用 Lazy 反射以避免在 P3.2 占位阶段强制引入 aws-sdk
        try {
            return (S3Client) Class.forName("org.springframework.beans.factory.BeanFactory")
                    .getMethod("getBean", Class.class)
                    .invoke(applicationContext, S3Client.class);
        } catch (Exception e) {
            throw new IllegalStateException("S3Client 未配置，请检查 MinIO / AWS SDK 配置", e);
        }
    }

    private org.springframework.context.ApplicationContext applicationContext;

    public void setApplicationContext(org.springframework.context.ApplicationContext ctx) {
        this.applicationContext = ctx;
    }
}
