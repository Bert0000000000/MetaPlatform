package com.metaplatform.appservice.domain.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.appservice.api.error.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Java 后端直接调用 Flowable 8 REST API。
 *
 * <p>默认地址：{@code http://localhost:8081/flowable-rest/service}，basic auth admin/test。
 * 可通过 {@code metaplatform.flowable.rest-url} 和 {@code metaplatform.flowable.auth} 覆盖。
 */
@Component
public class FlowableRestClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${metaplatform.flowable.rest-url:http://localhost:8081/flowable-rest/service}")
    private String baseUrl;

    @Value("${metaplatform.flowable.auth:admin:test}")
    private String auth;

    private String authHeader() {
        return "Basic " + Base64.getEncoder().encodeToString(auth.getBytes());
    }

    private HttpHeaders headers(MediaType contentType) {
        HttpHeaders h = new HttpHeaders();
        h.set("Authorization", authHeader());
        if (contentType != null) {
            h.setContentType(contentType);
        }
        return h;
    }

    /**
     * 部署 BPMN XML。
     *
     * @param name    部署名称
     * @param bpmnXml BPMN 2.0 XML
     * @return Flowable deployment JSON
     */
    public JsonNode deploy(String name, String bpmnXml) {
        try {
            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            builder.part("file", bpmnXml.getBytes(), MediaType.APPLICATION_XML)
                    .header("Content-Disposition", "form-data; name=\"file\"; filename=\"" + name + ".bpmn20.xml\"");

            MultiValueMap<String, HttpEntity<?>> parts = builder.build();
            HttpHeaders h = headers(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, HttpEntity<?>>> req = new HttpEntity<>(parts, h);

            ResponseEntity<String> res = restTemplate.postForEntity(
                    baseUrl + "/repository/deployments", req, String.class);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw ApiException.internalError("Flowable 部署失败: " + res.getBody());
            }
            return objectMapper.readTree(res.getBody());
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.internalError("Flowable 部署异常: " + e.getMessage());
        }
    }

    /**
     * 根据 deploymentId 查询流程定义。
     */
    public List<JsonNode> listProcessDefinitions(String deploymentId) {
        try {
            HttpEntity<Void> req = new HttpEntity<>(headers(null));
            ResponseEntity<String> res = restTemplate.exchange(
                    baseUrl + "/repository/process-definitions?deploymentId=" + deploymentId,
                    HttpMethod.GET, req, String.class);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw ApiException.internalError("Flowable 查询流程定义失败: " + res.getBody());
            }
            JsonNode root = objectMapper.readTree(res.getBody());
            JsonNode data = root.path("data");
            if (data.isArray()) {
                return objectMapper.readerForListOf(JsonNode.class).readValue(data);
            }
            return List.of();
        } catch (Exception e) {
            throw ApiException.internalError("Flowable 查询流程定义异常: " + e.getMessage());
        }
    }

    /**
     * 启动流程实例。
     */
    public JsonNode startProcessInstance(String processDefinitionId, String businessKey,
                                         Map<String, Object> variables) {
        try {
            List<Map<String, Object>> vars = variables.entrySet().stream()
                    .map(e -> Map.of("name", e.getKey(), "value", e.getValue()))
                    .toList();
            Map<String, Object> body = Map.of(
                    "processDefinitionId", processDefinitionId,
                    "businessKey", businessKey,
                    "variables", vars
            );
            HttpEntity<Map<String, Object>> req = new HttpEntity<>(body, headers(MediaType.APPLICATION_JSON));
            ResponseEntity<String> res = restTemplate.postForEntity(
                    baseUrl + "/runtime/process-instances", req, String.class);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw ApiException.internalError("Flowable 启动流程实例失败: " + res.getBody());
            }
            return objectMapper.readTree(res.getBody());
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.internalError("Flowable 启动流程实例异常: " + e.getMessage());
        }
    }

    /**
     * 查询任务列表。
     */
    public List<JsonNode> listTasks(Map<String, String> params) {
        try {
            StringBuilder url = new StringBuilder(baseUrl + "/runtime/tasks?");
            params.forEach((k, v) -> url.append(k).append("=").append(v).append("&"));
            HttpEntity<Void> req = new HttpEntity<>(headers(null));
            ResponseEntity<String> res = restTemplate.exchange(
                    url.toString(), HttpMethod.GET, req, String.class);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw ApiException.internalError("Flowable 查询任务失败: " + res.getBody());
            }
            JsonNode root = objectMapper.readTree(res.getBody());
            JsonNode data = root.path("data");
            if (data.isArray()) {
                return objectMapper.readerForListOf(JsonNode.class).readValue(data);
            }
            return List.of();
        } catch (Exception e) {
            throw ApiException.internalError("Flowable 查询任务异常: " + e.getMessage());
        }
    }

    /**
     * 完成任务。
     */
    public void completeTask(String taskId, Map<String, Object> variables) {
        try {
            List<Map<String, Object>> vars = variables.entrySet().stream()
                    .map(e -> Map.of("name", e.getKey(), "value", e.getValue()))
                    .toList();
            Map<String, Object> body = Map.of("action", "complete", "variables", vars);
            HttpEntity<Map<String, Object>> req = new HttpEntity<>(body, headers(MediaType.APPLICATION_JSON));
            ResponseEntity<String> res = restTemplate.postForEntity(
                    baseUrl + "/runtime/tasks/" + taskId, req, String.class);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw ApiException.internalError("Flowable 完成任务失败: " + res.getBody());
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.internalError("Flowable 完成任务异常: " + e.getMessage());
        }
    }

    /**
     * 查询单个任务。
     */
    public JsonNode getTask(String taskId) {
        try {
            HttpEntity<Void> req = new HttpEntity<>(headers(null));
            ResponseEntity<String> res = restTemplate.exchange(
                    baseUrl + "/runtime/tasks/" + taskId, HttpMethod.GET, req, String.class);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw ApiException.internalError("Flowable 查询任务失败: " + res.getBody());
            }
            return objectMapper.readTree(res.getBody());
        } catch (Exception e) {
            throw ApiException.internalError("Flowable 查询任务异常: " + e.getMessage());
        }
    }

    /**
     * 查询流程实例。
     */
    public JsonNode getProcessInstance(String processInstanceId) {
        try {
            HttpEntity<Void> req = new HttpEntity<>(headers(null));
            ResponseEntity<String> res = restTemplate.exchange(
                    baseUrl + "/runtime/process-instances/" + processInstanceId,
                    HttpMethod.GET, req, String.class);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw ApiException.internalError("Flowable 查询流程实例失败: " + res.getBody());
            }
            return objectMapper.readTree(res.getBody());
        } catch (Exception e) {
            throw ApiException.internalError("Flowable 查询流程实例异常: " + e.getMessage());
        }
    }

    /**
     * 查询历史活动节点（用于流程图高亮）。
     */
    public List<JsonNode> listHistoricActivities(String processInstanceId) {
        try {
            HttpEntity<Void> req = new HttpEntity<>(headers(null));
            ResponseEntity<String> res = restTemplate.exchange(
                    baseUrl + "/history/historic-activity-instances?processInstanceId=" + processInstanceId,
                    HttpMethod.GET, req, String.class);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw ApiException.internalError("Flowable 查询历史活动失败: " + res.getBody());
            }
            JsonNode root = objectMapper.readTree(res.getBody());
            JsonNode data = root.path("data");
            if (data.isArray()) {
                return objectMapper.readerForListOf(JsonNode.class).readValue(data);
            }
            return List.of();
        } catch (Exception e) {
            throw ApiException.internalError("Flowable 查询历史活动异常: " + e.getMessage());
        }
    }
}
