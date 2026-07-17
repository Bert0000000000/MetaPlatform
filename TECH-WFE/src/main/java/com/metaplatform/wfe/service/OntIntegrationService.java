package com.metaplatform.wfe.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TraceContext;
import com.metaplatform.wfe.exception.WfeException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

/**
 * TECH-ONT 集成：流程变量绑定业务对象（P1-WFE-08）。
 */
@Slf4j
@Service
public class OntIntegrationService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final WebClient ontWebClient;

    public OntIntegrationService(@Qualifier("ontWebClient") WebClient ontWebClient) {
        this.ontWebClient = ontWebClient;
    }

    /**
     * 获取本体实体详情（含属性值）。
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> resolveEntity(String tenantId, String conceptCode, String entityCode) {
        try {
            String json = ontWebClient.get()
                    .uri("/api/v1/ont/concepts/" + conceptCode + "/entities/" + entityCode)
                    .header("X-Tenant-Id", tenantId)
                    .header(TraceContext.TRACE_ID_HEADER, TraceContext.getOrCreate())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return parseEntity(json);
        } catch (WfeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to resolve entity from ONT: tenantId={}, conceptCode={}, entityCode={}, error={}",
                    tenantId, conceptCode, entityCode, e.getMessage());
            throw new WfeException(ErrorCode.DEPENDENCY_ERROR, "获取业务对象失败: " + e.getMessage());
        }
    }

    /**
     * 绑定流程变量到业务对象：解析实体并返回可序列化的实体数据，
     * 由 ProcessInstanceService 负责写入流程实例 variables。
     */
    public Map<String, Object> bindProcessVariable(String tenantId, String processInstanceId,
                                                   String variableName, String conceptCode, String entityCode) {
        log.info("Binding process variable: processInstanceId={}, variableName={}, conceptCode={}, entityCode={}",
                processInstanceId, variableName, conceptCode, entityCode);
        return resolveEntity(tenantId, conceptCode, entityCode);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseEntity(String json) throws Exception {
        if (json == null || json.isBlank()) {
            throw new WfeException(ErrorCode.ONT_ENTITY_NOT_FOUND, "业务对象实体响应为空");
        }
        JsonNode root = OBJECT_MAPPER.readTree(json);
        int code = root.path("code").asInt(-1);
        if (code == 40404 || root.path("data").isMissingNode() || root.path("data").isNull()) {
            throw new WfeException(ErrorCode.ONT_ENTITY_NOT_FOUND, "业务对象实体不存在");
        }
        JsonNode data = root.path("data");
        return OBJECT_MAPPER.convertValue(data, Map.class);
    }
}
