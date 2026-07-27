package com.metaplatform.wfe.apphub.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.apphub.dto.AppReleaseCreateRequest;
import com.metaplatform.wfe.apphub.dto.AppReleaseResponse;
import com.metaplatform.wfe.apphub.dto.ReleaseApprovalStartRequest;
import com.metaplatform.wfe.apphub.dto.ReleaseLogResponse;
import com.metaplatform.wfe.apphub.entity.*;
import com.metaplatform.wfe.apphub.repository.AppReleaseLogRepository;
import com.metaplatform.wfe.apphub.repository.AppReleaseRepository;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.dto.ProcessInstanceResponse;
import com.metaplatform.wfe.exception.WfeException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AppReleaseService {

    private final AppReleaseRepository appReleaseRepository;
    private final AppReleaseLogRepository appReleaseLogRepository;
    private final ReleaseApprovalProcessService releaseApprovalProcessService;
    private final ObjectMapper objectMapper;

    @Transactional
    public AppReleaseResponse create(AppReleaseCreateRequest request) {
        String tenantId = TenantContext.get();
        String userId = TenantContext.getUserId();

        if (appReleaseRepository.existsByTenantIdAndAppIdAndVersion(
                tenantId, request.getAppId(), request.getVersion())) {
            throw new WfeException(ErrorCode.APP_RELEASE_STATUS_CONFLICT,
                    "该应用版本已存在发布记录: appId=" + request.getAppId() + ", version=" + request.getVersion());
        }

        String releaseId = UUID.randomUUID().toString();
        AppReleaseEntity entity = AppReleaseEntity.builder()
                .id(releaseId)
                .tenantId(tenantId)
                .appId(request.getAppId())
                .version(request.getVersion())
                .releaseNotes(serializeReleaseNotes(request.getReleaseNotes()))
                .strategy(parseStrategy(request.getStrategy()))
                .grayPercent(request.getGrayPercent())
                .grayUsers(request.getGrayUsers())
                .grayDepts(request.getGrayDepts())
                .status(AppReleaseStatus.PENDING_APPROVAL)
                .approvalStatus(ApprovalStatus.PENDING)
                .createdBy(userId)
                .build();
        appReleaseRepository.save(entity);

        ReleaseApprovalStartRequest startRequest = toStartRequest(request);
        ProcessInstanceResponse processInstance = releaseApprovalProcessService.start(startRequest, releaseId);
        entity.setProcessInstanceId(processInstance.getId());
        appReleaseRepository.save(entity);

        Map<String, Object> remark = new HashMap<>();
        remark.put("text", String.format("策略=%s, 灰度比例=%d%%", request.getStrategy(), request.getGrayPercent()));
        saveLog(releaseId, "提交发布申请", userId, remark);

        log.info("App release created: releaseId={}, appId={}, version={}",
                releaseId, request.getAppId(), request.getVersion());
        return toResponse(entity);
    }

    @Transactional(readOnly = true)
    public PageResponse<AppReleaseResponse> list(String appId, int page, int size) {
        String tenantId = TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, size),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AppReleaseEntity> result = appReleaseRepository
                .findByTenantIdAndAppIdOrderByCreatedAtDesc(tenantId, appId, pageRequest);
        return PageResponse.<AppReleaseResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(size)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public AppReleaseResponse get(String releaseId) {
        return toResponse(findById(releaseId));
    }

    @Transactional(readOnly = true)
    public List<ReleaseLogResponse> getLogs(String releaseId) {
        AppReleaseEntity release = findById(releaseId);
        return appReleaseLogRepository.findByReleaseIdOrderByCreatedAtDesc(release.getId())
                .stream()
                .map(this::toLogResponse)
                .toList();
    }

    private AppReleaseEntity findById(String releaseId) {
        return appReleaseRepository.findByIdAndTenantId(releaseId, TenantContext.get())
                .orElseThrow(() -> new WfeException(ErrorCode.APP_RELEASE_NOT_FOUND,
                        "应用发布记录不存在: " + releaseId));
    }

    private ReleaseApprovalStartRequest toStartRequest(AppReleaseCreateRequest request) {
        ReleaseApprovalStartRequest startRequest = new ReleaseApprovalStartRequest();
        startRequest.setAppId(request.getAppId());
        startRequest.setVersion(request.getVersion());
        startRequest.setReleaseNotes(request.getReleaseNotes());
        startRequest.setStrategy(request.getStrategy());
        startRequest.setGrayPercent(request.getGrayPercent());
        startRequest.setGrayUsers(request.getGrayUsers());
        startRequest.setGrayDepts(request.getGrayDepts());
        startRequest.setTechLeadId(request.getTechLeadId());
        startRequest.setOpsOwnerId(request.getOpsOwnerId());
        return startRequest;
    }

    private AppReleaseStrategy parseStrategy(String strategy) {
        try {
            return AppReleaseStrategy.valueOf(strategy);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new WfeException(ErrorCode.INVALID_FIELD_VALUE, "无效的发布策略: " + strategy);
        }
    }

    private String serializeReleaseNotes(Map<String, Object> notes) {
        if (notes == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(notes);
        } catch (Exception e) {
            throw new WfeException(ErrorCode.INVALID_PARAM, "releaseNotes 序列化失败: " + e.getMessage());
        }
    }

    private Map<String, Object> deserializeReleaseNotes(String notes) {
        if (notes == null || notes.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(notes, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to deserialize releaseNotes: {}", e.getMessage());
            return null;
        }
    }

    private void saveLog(String releaseId, String action, String operator, Map<String, Object> remark) {
        AppReleaseLogEntity logEntity = AppReleaseLogEntity.builder()
                .id(UUID.randomUUID().toString())
                .releaseId(releaseId)
                .action(action)
                .operator(operator)
                .remark(remark)
                .build();
        appReleaseLogRepository.save(logEntity);
    }

    private AppReleaseResponse toResponse(AppReleaseEntity entity) {
        return AppReleaseResponse.builder()
                .releaseId(entity.getId())
                .appId(entity.getAppId())
                .version(entity.getVersion())
                .releaseNotes(deserializeReleaseNotes(entity.getReleaseNotes()))
                .strategy(entity.getStrategy() == null ? null : entity.getStrategy().name())
                .grayPercent(entity.getGrayPercent())
                .grayUsers(entity.getGrayUsers())
                .grayDepts(entity.getGrayDepts())
                .status(entity.getStatus() == null ? null : entity.getStatus().name())
                .approvalStatus(entity.getApprovalStatus() == null ? null : entity.getApprovalStatus().name())
                .processInstanceId(entity.getProcessInstanceId())
                .createdBy(entity.getCreatedBy())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private ReleaseLogResponse toLogResponse(AppReleaseLogEntity entity) {
        return ReleaseLogResponse.builder()
                .logId(entity.getId())
                .releaseId(entity.getReleaseId())
                .action(entity.getAction())
                .operator(entity.getOperator())
                .remark(entity.getRemark())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
