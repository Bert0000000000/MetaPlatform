package com.metaplatform.wfe.apphub.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.apphub.dto.ReleaseApprovalCompleteRequest;
import com.metaplatform.wfe.apphub.dto.ReleaseApprovalStartRequest;
import com.metaplatform.wfe.apphub.entity.*;
import com.metaplatform.wfe.apphub.repository.AppReleaseLogRepository;
import com.metaplatform.wfe.apphub.repository.AppReleaseRepository;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.dto.DeployRequest;
import com.metaplatform.wfe.dto.ProcessInstanceResponse;
import com.metaplatform.wfe.dto.StartProcessInstanceRequest;
import com.metaplatform.wfe.dto.TaskActionRequest;
import com.metaplatform.wfe.dto.TaskActionResponse;
import com.metaplatform.wfe.dto.TaskResponse;
import com.metaplatform.wfe.entity.ProcessDefinitionEntity;
import com.metaplatform.wfe.entity.ProcessDefinitionStatus;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.ProcessDefinitionRepository;
import com.metaplatform.wfe.service.ProcessDefinitionService;
import com.metaplatform.wfe.service.ProcessInstanceService;
import com.metaplatform.wfe.service.WfeTaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.HistoryService;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.task.api.history.HistoricTaskInstance;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReleaseApprovalProcessService {

    private static final String PROCESS_KEY = "releaseApprovalProcess";
    private static final String PROCESS_NAME = "应用发布审批流程";
    private static final String BPMN_RESOURCE = "processes/release-approval.bpmn20.xml";

    private final ProcessDefinitionService processDefinitionService;
    private final ProcessDefinitionRepository processDefinitionRepository;
    private final ProcessInstanceService processInstanceService;
    private final WfeTaskService wfeTaskService;
    private final HistoryService historyService;
    private final AppReleaseRepository appReleaseRepository;
    private final AppReleaseLogRepository appReleaseLogRepository;

    @Transactional
    public ProcessInstanceResponse start(ReleaseApprovalStartRequest request, String releaseId) {
        String tenantId = TenantContext.get();
        String processDefinitionId = ensureDeployed(tenantId);

        Map<String, Object> variables = new HashMap<>();
        variables.put("appId", request.getAppId());
        variables.put("version", request.getVersion());
        variables.put("releaseNotes", request.getReleaseNotes());
        variables.put("strategy", request.getStrategy());
        variables.put("grayPercent", request.getGrayPercent());
        variables.put("grayUsers", request.getGrayUsers());
        variables.put("grayDepts", request.getGrayDepts());
        variables.put("techLeadId", request.getTechLeadId());
        variables.put("opsOwnerId", request.getOpsOwnerId());

        StartProcessInstanceRequest startRequest = new StartProcessInstanceRequest();
        startRequest.setProcessDefinitionId(processDefinitionId);
        startRequest.setBusinessKey(releaseId);
        startRequest.setVariables(variables);

        ProcessInstanceResponse response = processInstanceService.start(startRequest);
        log.info("Release approval process started: releaseId={}, processInstanceId={}",
                releaseId, response.getId());
        return response;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> getTasks(String processInstanceId) {
        return wfeTaskService.getTasksByProcessInstance(processInstanceId);
    }

    @Transactional
    public TaskActionResponse complete(String processInstanceId, String taskId,
                                       ReleaseApprovalCompleteRequest request) {
        boolean approved = Boolean.TRUE.equals(request.getApproved());
        String comment = request.getComment() != null ? request.getComment() : "";

        TaskActionRequest actionRequest = new TaskActionRequest();
        actionRequest.setAction(approved ? "APPROVE" : "REJECT");
        actionRequest.setComment(comment);

        TaskActionResponse response = wfeTaskService.executeAction(taskId, actionRequest);

        recordTaskCompletionLog(processInstanceId, taskId, approved, comment);
        finishReleaseIfProcessEnded(processInstanceId, approved, comment);

        log.info("Release approval task completed: processInstanceId={}, taskId={}, approved={}",
                processInstanceId, taskId, approved);
        return response;
    }

    private String ensureDeployed(String tenantId) {
        Optional<ProcessDefinitionEntity> existing = processDefinitionRepository
                .findFirstByTenantIdAndProcessKeyAndStatusNotOrderByVersionDesc(
                        tenantId, PROCESS_KEY, ProcessDefinitionStatus.DELETED);
        if (existing.isPresent()) {
            return existing.get().getId();
        }

        String bpmnXml = loadBpmnXml();
        DeployRequest deployRequest = new DeployRequest();
        deployRequest.setProcessKey(PROCESS_KEY);
        deployRequest.setName(PROCESS_NAME);
        deployRequest.setBpmnXml(bpmnXml);
        return processDefinitionService.deploy(deployRequest).getId();
    }

    private String loadBpmnXml() {
        try {
            ClassPathResource resource = new ClassPathResource(BPMN_RESOURCE);
            return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.error("Failed to load release approval BPMN XML", e);
            throw new WfeException(ErrorCode.INTERNAL_ERROR, "加载发布审批流程定义失败");
        }
    }

    private void recordTaskCompletionLog(String processInstanceId, String taskId,
                                         boolean approved, String comment) {
        appReleaseRepository.findByProcessInstanceId(processInstanceId).ifPresent(release -> {
            String taskName = resolveTaskName(taskId);
            String action = (approved ? "审批通过: " : "审批驳回: ") + taskName;
            saveLog(release.getId(), action, TenantContext.getUserId(), comment);
        });
    }

    private void finishReleaseIfProcessEnded(String processInstanceId, boolean approved, String comment) {
        HistoricProcessInstance hpi = historyService.createHistoricProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult();
        if (hpi == null || hpi.getEndTime() == null) {
            return;
        }

        boolean reallyApproved = approved
                && (hpi.getDeleteReason() == null || !hpi.getDeleteReason().startsWith("REJECTED"));

        appReleaseRepository.findByProcessInstanceId(processInstanceId).ifPresent(release -> {
            if (release.getStatus() != AppReleaseStatus.PENDING_APPROVAL) {
                return;
            }
            if (reallyApproved) {
                release.setStatus(AppReleaseStatus.PUBLISHED);
                release.setApprovalStatus(ApprovalStatus.APPROVED);
                saveLog(release.getId(), "发布已批准", TenantContext.getUserId(), comment);
            } else {
                release.setStatus(AppReleaseStatus.REJECTED);
                release.setApprovalStatus(ApprovalStatus.REJECTED);
                saveLog(release.getId(), "发布已驳回", TenantContext.getUserId(), comment);
            }
            appReleaseRepository.save(release);
        });
    }

    private String resolveTaskName(String taskId) {
        HistoricTaskInstance hti = historyService.createHistoricTaskInstanceQuery()
                .taskId(taskId)
                .singleResult();
        return hti != null ? hti.getName() : "审批任务";
    }

    private void saveLog(String releaseId, String action, String operator, String remark) {
        try {
            AppReleaseLogEntity logEntity = AppReleaseLogEntity.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .releaseId(releaseId)
                    .action(action)
                    .operator(operator)
                    .remark(remark)
                    .build();
            appReleaseLogRepository.save(logEntity);
        } catch (Exception e) {
            log.warn("Failed to save release log (non-blocking): releaseId={}, action={}, error={}",
                    releaseId, action, e.getMessage());
        }
    }
}
