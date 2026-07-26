package com.metaplatform.agent.workspace;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Thread Workspace Provisioner (P3.2.2).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkspaceProvisioner {

    @Value("${mate.workspace.bucket:metaplatform-workspaces}")
    private String bucket;

    public String allocatePath(String tenantId, String threadId, String subPath) {
        return "workspaces/" + tenantId + "/" + threadId + "/" + subPath;
    }

    public void putFile(String key, String content) {
        try {
            S3Client client = s3Client();
            client.putObject(
                PutObjectRequest.builder().bucket(bucket).key(key).build(),
                software.amazon.awssdk.core.sync.RequestBody.fromBytes(content.getBytes(StandardCharsets.UTF_8))
            );
            log.debug("[WorkspaceProvisioner] put key={}", key);
        } catch (Exception e) {
            log.warn("[WorkspaceProvisioner] putFile failed key={}: {}", key, e.getMessage());
        }
    }

    public int putAll(Map<String, String> files) {
        int n = 0;
        for (Map.Entry<String, String> e : files.entrySet()) {
            putFile(e.getKey(), e.getValue());
            n++;
        }
        return n;
    }

    private S3Client s3Client() {
        try {
            return (S3Client) Class.forName("org.springframework.beans.factory.BeanFactory")
                    .getMethod("getBean", Class.class)
                    .invoke(applicationContext, S3Client.class);
        } catch (Exception e) {
            throw new IllegalStateException("S3Client bean not configured", e);
        }
    }

    private org.springframework.context.ApplicationContext applicationContext;

    public void setApplicationContext(org.springframework.context.ApplicationContext ctx) {
        this.applicationContext = ctx;
    }
}