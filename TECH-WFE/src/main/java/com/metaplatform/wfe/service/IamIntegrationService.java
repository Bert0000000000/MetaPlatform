package com.metaplatform.wfe.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TraceContext;
import com.metaplatform.wfe.dto.AssigneeInfo;
import com.metaplatform.wfe.exception.WfeException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

/**
 * TECH-IAM 集成：审批人解析与权限校验（P1-WFE-06）。
 */
@Slf4j
@Service
public class IamIntegrationService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final WebClient iamWebClient;

    public IamIntegrationService(@Qualifier("iamWebClient") WebClient iamWebClient) {
        this.iamWebClient = iamWebClient;
    }

    /**
     * 解析候选审批人：优先按部门，其次按角色。
     */
    public List<AssigneeInfo> resolveAssignees(String tenantId, String roleCode, String deptId) {
        try {
            String path;
            if (deptId != null && !deptId.isBlank()) {
                path = "/api/v1/iam/departments/" + deptId + "/members";
            } else {
                path = "/api/v1/iam/roles/" + roleCode + "/users";
            }

            String json = iamWebClient.get()
                    .uri(path)
                    .header("X-Tenant-Id", tenantId)
                    .header(TraceContext.TRACE_ID_HEADER, TraceContext.getOrCreate())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return parseAssigneeList(json);
        } catch (Exception e) {
            log.error("Failed to resolve assignees from IAM: tenantId={}, roleCode={}, deptId={}, error={}",
                    tenantId, roleCode, deptId, e.getMessage());
            throw new WfeException(ErrorCode.PERMISSION_CHECK_FAILED, "解析审批人失败: " + e.getMessage());
        }
    }

    /**
     * 校验用户是否有权对指定资源执行操作。
     */
    public boolean checkPermission(String tenantId, String userId, String resource, String action) {
        try {
            Map<String, Object> body = Map.of(
                    "userId", userId != null ? userId : "",
                    "resource", resource,
                    "action", action);

            String json = iamWebClient.post()
                    .uri("/api/v1/iam/permissions/check")
                    .header("X-Tenant-Id", tenantId)
                    .header(TraceContext.TRACE_ID_HEADER, TraceContext.getOrCreate())
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return parseAllowed(json);
        } catch (Exception e) {
            log.error("Failed to check permission from IAM: tenantId={}, userId={}, resource={}, action={}, error={}",
                    tenantId, userId, resource, action, e.getMessage());
            throw new WfeException(ErrorCode.PERMISSION_CHECK_FAILED, "权限校验失败: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private List<AssigneeInfo> parseAssigneeList(String json) throws Exception {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        JsonNode root = OBJECT_MAPPER.readTree(json);
        JsonNode data = root.path("data");
        if (data.isMissingNode() || data.isNull()) {
            return List.of();
        }
        List<Map<String, Object>> items = OBJECT_MAPPER.convertValue(data, List.class);
        return items.stream()
                .map(m -> AssigneeInfo.builder()
                        .userId((String) m.get("userId"))
                        .username((String) m.get("username"))
                        .build())
                .toList();
    }

    private boolean parseAllowed(String json) throws Exception {
        if (json == null || json.isBlank()) {
            return false;
        }
        JsonNode root = OBJECT_MAPPER.readTree(json);
        int code = root.path("code").asInt(-1);
        if (code != 0) {
            return false;
        }
        JsonNode data = root.path("data");
        if (data.isBoolean()) {
            return data.asBoolean();
        }
        return data.path("allowed").asBoolean(false);
    }
}
