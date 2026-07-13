package com.metaplatform.appservice.domain.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.app.AppService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * 流程实例查询服务：提供实例详情、历史活动、当前任务和 BPMN XML。
 */
@Service
public class ProcessInstanceService {

    private final FlowableRestClient flowableRestClient;
    private final AppWorkflowDefinitionRepository definitionRepository;
    private final AppService appService;

    public ProcessInstanceService(FlowableRestClient flowableRestClient,
                                  AppWorkflowDefinitionRepository definitionRepository,
                                  AppService appService) {
        this.flowableRestClient = flowableRestClient;
        this.definitionRepository = definitionRepository;
        this.appService = appService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDetail(String appIdOrSlug, String processInstanceId) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();

        JsonNode instance = flowableRestClient.getProcessInstance(processInstanceId);
        if (instance == null || instance.path("id").isMissingNode()) {
            throw ApiException.notFound("流程实例不存在: " + processInstanceId);
        }
        String processDefinitionId = instance.path("processDefinitionId").asText();

        AppWorkflowDefinitionEntity def = definitionRepository.findByProcessDefinitionId(processDefinitionId)
                .orElseThrow(() -> ApiException.notFound("流程定义不存在"));
        if (!appId.equals(def.getAppId())) {
            throw ApiException.forbidden("无权访问该流程实例");
        }

        List<JsonNode> historic = flowableRestClient.listHistoricActivities(processInstanceId);
        List<JsonNode> currentTasks = flowableRestClient.listTasks(Map.of("processInstanceId", processInstanceId));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("instance", jsonToMap(instance));
        result.put("bpmnXml", def.getBpmnXml());
        result.put("historicActivities", historic.stream().map(this::jsonToMap).toList());
        result.put("currentTasks", currentTasks.stream().map(this::jsonToMap).toList());
        result.put("workflowDefinition", Map.of(
                "id", def.getId(),
                "name", def.getName(),
                "code", def.getCode(),
                "status", def.getStatus()
        ));
        return result;
    }

    private Map<String, Object> jsonToMap(JsonNode node) {
        Map<String, Object> map = new LinkedHashMap<>();
        if (node == null || !node.isObject()) return map;
        node.fields().forEachRemaining(entry -> {
            JsonNode v = entry.getValue();
            if (v.isObject()) {
                map.put(entry.getKey(), jsonToMap(v));
            } else if (v.isArray()) {
                List<Object> list = new ArrayList<>();
                for (JsonNode item : v) {
                    list.add(item.isObject() || item.isArray() ? jsonToMap(item) : valueOf(item));
                }
                map.put(entry.getKey(), list);
            } else {
                map.put(entry.getKey(), valueOf(v));
            }
        });
        return map;
    }

    private Object valueOf(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isTextual()) return node.asText();
        if (node.isNumber()) return node.numberValue();
        if (node.isBoolean()) return node.asBoolean();
        return node.asText();
    }
}
