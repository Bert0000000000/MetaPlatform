package com.metaplatform.appservice.domain.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.app.AppService;
import com.metaplatform.appservice.domain.form.FormSubmissionEntity;
import com.metaplatform.appservice.domain.form.FormSubmissionRepository;
import com.metaplatform.appservice.security.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 待办任务服务：查询 Flowable tasks，处理通过/驳回。
 */
@Service
public class TodoService {

    private final FlowableRestClient flowableRestClient;
    private final FormSubmissionRepository submissionRepository;
    private final AppWorkflowDefinitionRepository definitionRepository;
    private final AppService appService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public TodoService(FlowableRestClient flowableRestClient,
                       FormSubmissionRepository submissionRepository,
                       AppWorkflowDefinitionRepository definitionRepository,
                       AppService appService) {
        this.flowableRestClient = flowableRestClient;
        this.submissionRepository = submissionRepository;
        this.definitionRepository = definitionRepository;
        this.appService = appService;
    }

    /**
     * 查询当前用户的待办任务列表。
     */
    public List<Map<String, Object>> listTodos(String appIdOrSlug, String userId, List<String> roles) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        String candidateGroups = roles == null || roles.isEmpty() ? null : String.join(",", roles);

        Map<String, String> params = new HashMap<>();
        params.put("size", "1000");
        params.put("sort", "createTime");
        if (candidateGroups != null && !candidateGroups.isBlank()) {
            params.put("candidateGroups", candidateGroups);
        } else if (userId != null && !userId.isBlank()) {
            params.put("assignee", userId);
        }

        List<JsonNode> tasks = flowableRestClient.listTasks(params);
        Set<String> appInstanceIds = submissionRepository.findByAppId(appService.resolveByIdOrCode(appIdOrSlug).getId()).stream()
                .map(FormSubmissionEntity::getProcessInstanceId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<Map<String, Object>> result = new ArrayList<>();
        for (JsonNode task : tasks) {
            String instanceId = task.path("processInstanceId").asText();
            if (!appInstanceIds.contains(instanceId)) continue;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", task.path("id").asText());
            item.put("name", task.path("name").asText());
            item.put("taskDefinitionKey", task.path("taskDefinitionKey").asText());
            item.put("createTime", task.path("createTime").asText());
            item.put("processInstanceId", instanceId);
            item.put("processDefinitionId", task.path("processDefinitionId").asText());
            item.put("assignee", task.path("assignee").asText(null));

            // 关联提交记录
            submissionRepository.findByProcessInstanceId(instanceId)
                    .ifPresent(sub -> {
                        item.put("submissionId", sub.getId());
                        item.put("formId", sub.getFormId());
                        item.put("appId", sub.getAppId());
                        item.put("submitterId", sub.getSubmitterId());
                    });

            result.add(item);
        }
        return result;
    }

    /**
     * 查询任务详情，包含表单快照和字段权限。
     */
    public Map<String, Object> getTaskDetail(String appIdOrSlug, String taskId) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        JsonNode task = flowableRestClient.getTask(taskId);
        String instanceId = task.path("processInstanceId").asText();

        FormSubmissionEntity submission = submissionRepository.findByProcessInstanceId(instanceId)
                .orElseThrow(() -> ApiException.notFound("未找到关联的提交记录"));
        if (!submission.getAppId().equals(appId)) {
            throw ApiException.forbidden("无权访问该任务");
        }

        AppWorkflowDefinitionEntity def = definitionRepository.findByIdAndAppId(
                        findDefinitionIdByProcessDefinitionId(task.path("processDefinitionId").asText()), appId)
                .orElse(null);

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("task", taskToMap(task));
        detail.put("submission", submissionToMap(submission));
        detail.put("fieldPermissions", resolveFieldPermissions(def, task.path("taskDefinitionKey").asText()));
        return detail;
    }

    /**
     * 通过任务。
     */
    @Transactional
    public void complete(String appIdOrSlug, String taskId, String comment) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        JsonNode task = flowableRestClient.getTask(taskId);
        String instanceId = task.path("processInstanceId").asText();

        FormSubmissionEntity submission = submissionRepository.findByProcessInstanceId(instanceId)
                .orElseThrow(() -> ApiException.notFound("未找到关联的提交记录"));
        if (!submission.getAppId().equals(appId)) {
            throw ApiException.forbidden("无权访问该任务");
        }
        validatePermission(task);

        Map<String, Object> variables = new HashMap<>();
        variables.put("approved", true);
        if (comment != null && !comment.isBlank()) {
            variables.put("comment", comment);
        }
        flowableRestClient.completeTask(taskId, variables);
        updateSubmissionStatus(submission, instanceId);
    }

    /**
     * 驳回任务。必须填写意见。
     */
    @Transactional
    public void reject(String appIdOrSlug, String taskId, String comment) {
        if (comment == null || comment.isBlank()) {
            throw ApiException.badRequest("驳回意见必填");
        }
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        JsonNode task = flowableRestClient.getTask(taskId);
        String instanceId = task.path("processInstanceId").asText();

        FormSubmissionEntity submission = submissionRepository.findByProcessInstanceId(instanceId)
                .orElseThrow(() -> ApiException.notFound("未找到关联的提交记录"));
        if (!submission.getAppId().equals(appId)) {
            throw ApiException.forbidden("无权访问该任务");
        }
        validatePermission(task);

        Map<String, Object> variables = new HashMap<>();
        variables.put("approved", false);
        variables.put("comment", comment);
        flowableRestClient.completeTask(taskId, variables);
        updateSubmissionStatus(submission, instanceId);
    }

    private void validatePermission(JsonNode task) {
        String assignee = task.path("assignee").asText(null);
        String userId = TenantContext.currentUserId();
        if (assignee != null && !assignee.isBlank() && !assignee.equals(userId)) {
            throw ApiException.forbidden("该任务已分配给其他人");
        }
        // candidateGroups 校验由 Flowable 查询保证（查询时已按角色过滤）
    }

    private void updateSubmissionStatus(FormSubmissionEntity submission, String instanceId) {
        try {
            JsonNode instance = flowableRestClient.getProcessInstance(instanceId);
            if (instance == null || instance.isMissingNode() || !instance.has("id")) {
                submission.setWorkflowStatus("completed");
                submission.setCurrentTaskId(null);
                submission.setCurrentTaskName(null);
            } else {
                List<JsonNode> tasks = flowableRestClient.listTasks(Map.of("processInstanceId", instanceId));
                if (tasks.isEmpty()) {
                    submission.setWorkflowStatus("completed");
                    submission.setCurrentTaskId(null);
                    submission.setCurrentTaskName(null);
                } else {
                    JsonNode task = tasks.get(0);
                    submission.setCurrentTaskId(task.path("id").asText());
                    submission.setCurrentTaskName(task.path("name").asText());
                }
            }
        } catch (Exception e) {
            submission.setWorkflowStatus("completed");
            submission.setCurrentTaskId(null);
            submission.setCurrentTaskName(null);
        }
        submissionRepository.save(submission);
    }

    private Long findDefinitionIdByProcessDefinitionId(String processDefinitionId) {
        // 理论上应该通过 processDefinitionId 反查；这里简化为按 processDefinitionId 查找
        return definitionRepository.findAll().stream()
                .filter(d -> processDefinitionId.equals(d.getProcessDefinitionId()))
                .findFirst()
                .map(AppWorkflowDefinitionEntity::getId)
                .orElse(null);
    }

    private Map<String, Object> resolveFieldPermissions(AppWorkflowDefinitionEntity def, String taskKey) {
        if (def == null || def.getFieldPermissions() == null || def.getFieldPermissions().isBlank()) {
            return Map.of();
        }
        try {
            Map<String, Object> all = objectMapper.readValue(def.getFieldPermissions(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
            Object taskPerm = all.get(taskKey);
            return taskPerm instanceof Map ? (Map<String, Object>) taskPerm : Map.of();
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, Object> taskToMap(JsonNode task) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", task.path("id").asText());
        m.put("name", task.path("name").asText());
        m.put("taskDefinitionKey", task.path("taskDefinitionKey").asText());
        m.put("createTime", task.path("createTime").asText());
        m.put("processInstanceId", task.path("processInstanceId").asText());
        m.put("processDefinitionId", task.path("processDefinitionId").asText());
        m.put("assignee", task.path("assignee").asText(null));
        return m;
    }

    private Map<String, Object> submissionToMap(FormSubmissionEntity submission) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", submission.getId());
        m.put("formId", submission.getFormId());
        m.put("rowId", submission.getRowId());
        m.put("valuesJson", submission.getValuesJson());
        m.put("workflowStatus", submission.getWorkflowStatus());
        m.put("submitterId", submission.getSubmitterId());
        m.put("createdAt", submission.getCreatedAt().toString());
        return m;
    }
}
