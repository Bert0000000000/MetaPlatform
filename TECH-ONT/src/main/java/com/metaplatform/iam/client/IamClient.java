package com.metaplatform.iam.client;

import com.metaplatform.ont.context.PermissionSnapshotDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * IAM HTTP Client (P1.2.3 隔离版).
 */
@Slf4j
@Service
public class IamClient {

    @Value("${mate.iam.base-url:http://localhost:8101}")
    private String iamBaseUrl;

    public PermissionSnapshotDto buildSnapshot(String tenantId, String userId,
                                               String conceptCode, String objectId) {
        log.debug("[IamClient] buildSnapshot tenant={} user={} concept={} object={}",
                tenantId, userId, conceptCode, objectId);
        try {
            RestClient client = RestClient.builder().baseUrl(iamBaseUrl).build();
            Map<String, Object> body = Map.of(
                    "conceptCode", conceptCode,
                    "objectId", objectId,
                    "candidates", Map.of(
                            "actions", List.of(),
                            "relations", List.of(),
                            "concepts", List.of(conceptCode),
                            "metrics", List.of(),
                            "regions", List.of()
                    )
            );
            Map<String, Object> response = client.post()
                    .uri("/api/v1/iam/permission-snapshots/build")
                    .body(body)
                    .header("X-Tenant-Id", tenantId)
                    .header("X-User-Id", userId)
                    .retrieve()
                    .body(Map.class);
            String snapshotId = response == null ? "SNAP-DEFAULT"
                    : String.valueOf(((Map<?, ?>) response.get("data")).get("snapshotId"));
            return PermissionSnapshotDto.builder()
                    .snapshotId(snapshotId)
                    .dataScope("DEPARTMENT_TREE")
                    .rowFilter("tenant_id = '" + tenantId + "'")
                    .deniedFields(List.of())
                    .allowedActions(List.of())
                    .approvalRequiredActions(List.of())
                    .concepts(List.of(conceptCode))
                    .metrics(List.of())
                    .regions(List.of())
                    .build();
        } catch (Exception e) {
            log.warn("[IamClient] IAM call failed, local degrade: {}", e.getMessage());
            return PermissionSnapshotDto.builder()
                    .snapshotId("SNAP-DEGRADED")
                    .dataScope("SELF")
                    .rowFilter("1=0")
                    .deniedFields(List.of("bankAccount", "legalIdentityNumber"))
                    .allowedActions(List.of())
                    .approvalRequiredActions(List.of("ChangeDiscount", "SendOfficialOffer"))
                    .build();
        }
    }
}