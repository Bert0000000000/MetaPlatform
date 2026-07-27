package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.policy.ConditionSyntaxResponse;
import com.metaplatform.iam.dto.policy.CreatePolicyRequest;
import com.metaplatform.iam.dto.policy.MatrixColumnResponse;
import com.metaplatform.iam.dto.policy.MatrixRowResponse;
import com.metaplatform.iam.dto.policy.MatrixSubjectResponse;
import com.metaplatform.iam.dto.policy.PolicyMatrixResponse;
import com.metaplatform.iam.dto.policy.PolicyResponse;
import com.metaplatform.iam.dto.policy.UpdatePolicyRequest;
import com.metaplatform.iam.entity.PolicyEntity;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.PolicyRepository;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PolicyService {

    private final PolicyRepository policyRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    private static final String DEFAULT_ACTION = "invoke";

    @Transactional
    public PolicyResponse create(CreatePolicyRequest request) {
        String tenantId = resolveTenantId(request.getTenantId());
        String operator = currentOperator();
        PolicyEntity entity = PolicyEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .name(request.getName())
                .subjectType(request.getSubjectType())
                .subjectId(request.getSubjectId())
                .resourceType(request.getResourceType())
                .resourceIds(writeJson(request.getResourceIds()))
                .action(normalizeAction(request.getAction()))
                .effect(request.getEffect() == null ? PolicyEntity.Effect.ALLOW : request.getEffect())
                .conditionExpression(request.getConditionExpression())
                .effectiveStartAt(request.getEffectiveStartAt())
                .effectiveEndAt(request.getEffectiveEndAt())
                .priority(request.getPriority())
                .enabled(request.getEnabled())
                .deleted(false)
                .createdBy(operator)
                .updatedBy(operator)
                .version(1)
                .build();
        PolicyEntity saved = policyRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<PolicyResponse> list(String tenantId,
                                              String keyword,
                                              String subjectType,
                                              String subjectId,
                                              String resourceType,
                                              Integer page,
                                              Integer size) {
        String tid = resolveTenantId(tenantId);
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "priority")
                .and(Sort.by(Sort.Direction.DESC, "createdAt")));

        PolicyEntity.SubjectType st = parseSubjectType(subjectType);
        Page<PolicyEntity> result = policyRepository.search(tid, keyword, st, subjectId, resourceType, pageable);
        List<PolicyResponse> items = result.getContent().stream()
                .map(this::toResponse)
                .toList();
        return PageResponse.<PolicyResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public PolicyResponse get(String id) {
        PolicyEntity entity = policyRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "策略不存在"));
        return toResponse(entity);
    }

    @Transactional
    public PolicyResponse update(String id, UpdatePolicyRequest request) {
        PolicyEntity entity = policyRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "策略不存在"));
        if (!entity.getVersion().equals(request.getVersion())) {
            throw new IamException(ErrorCode.VERSION_CONFLICT, "策略版本不匹配");
        }
        entity.setName(request.getName());
        entity.setSubjectType(request.getSubjectType());
        entity.setSubjectId(request.getSubjectId());
        entity.setResourceType(request.getResourceType());
        entity.setResourceIds(writeJson(request.getResourceIds()));
        entity.setAction(normalizeAction(request.getAction()));
        entity.setEffect(request.getEffect());
        entity.setConditionExpression(request.getConditionExpression());
        entity.setEffectiveStartAt(request.getEffectiveStartAt());
        entity.setEffectiveEndAt(request.getEffectiveEndAt());
        entity.setPriority(request.getPriority());
        entity.setEnabled(request.getEnabled());
        entity.setUpdatedBy(currentOperator());
        PolicyEntity saved = policyRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String id) {
        PolicyEntity entity = policyRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "策略不存在"));
        entity.setDeleted(true);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        policyRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public PolicyMatrixResponse buildMatrix(String type, String action) {
        String tid = resolveTenantId(null);
        String act = normalizeAction(action == null ? DEFAULT_ACTION : action);
        PolicyEntity.SubjectType subjectType = parseMatrixType(type);

        List<PolicyEntity> policies = policyRepository
                .findByTenantIdAndSubjectTypeAndResourceTypeAndDeletedFalse(tid, subjectType, "tool");
        Instant now = Instant.now();

        Set<String> toolIds = new LinkedHashSet<>();
        Map<String, List<PolicyEntity>> policiesBySubject = policies.stream()
                .filter(p -> isPolicyEffective(p, now))
                .collect(Collectors.groupingBy(PolicyEntity::getSubjectId, LinkedHashMap::new, Collectors.toList()));

        for (List<PolicyEntity> list : policiesBySubject.values()) {
            for (PolicyEntity p : list) {
                toolIds.addAll(readJson(p.getResourceIds()));
            }
        }

        Map<String, String> userNames = subjectType == PolicyEntity.SubjectType.USER
                ? resolveUserNames(policiesBySubject.keySet())
                : Collections.emptyMap();

        List<MatrixColumnResponse> columns = toolIds.stream()
                .map(toolId -> MatrixColumnResponse.builder()
                        .toolId(toolId)
                        .toolCode(toolId)
                        .toolName(toolId)
                        .build())
                .toList();

        List<MatrixRowResponse> rows = policiesBySubject.keySet().stream()
                .sorted()
                .map(subjectId -> {
                    List<PolicyEntity> subjectPolicies = policiesBySubject.get(subjectId);
                    Map<String, String> cells = new LinkedHashMap<>();
                    for (String toolId : toolIds) {
                        cells.put(toolId, resolveCellEffect(subjectPolicies, toolId, act));
                    }
                    String name = subjectType == PolicyEntity.SubjectType.USER
                            ? userNames.getOrDefault(subjectId, subjectId)
                            : subjectId;
                    return MatrixRowResponse.builder()
                            .subject(MatrixSubjectResponse.builder()
                                    .subjectId(subjectId)
                                    .subjectName(name)
                                    .subjectType(subjectType)
                                    .build())
                            .cells(cells)
                            .build();
                })
                .toList();

        return PolicyMatrixResponse.builder()
                .type(type)
                .action(act)
                .columns(columns)
                .rows(rows)
                .build();
    }

    public byte[] exportMatrix(PolicyMatrixResponse matrix, String format) {
        if ("xlsx".equalsIgnoreCase(format)) {
            return exportXlsx(matrix);
        }
        return exportCsv(matrix).getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public ConditionSyntaxResponse conditionSyntax() {
        return ConditionSyntaxResponse.builder()
                .syntax("SpEL-like / JSON-logic")
                .description("条件表达式用于在运行时根据请求上下文判断是否生效。返回 true 表示策略生效。")
                .examples(List.of(
                        "#env.get('client.ip').startsWith('10.0.')",
                        "#time.getHour() >= 9 && #time.getHour() <= 18",
                        "{ \"and\": [{ \">=\": [{\"var\":\"riskScore\"}, 80] }] }",
                        "#user.deptId == 'dept-001' || #user.level > 3"
                ))
                .variables(List.of("env", "time", "user", "request"))
                .build();
    }

    private String resolveCellEffect(List<PolicyEntity> policies, String toolId, String action) {
        boolean hasAllow = false;
        for (PolicyEntity p : policies.stream()
                .sorted(Comparator.comparing(PolicyEntity::getPriority).reversed())
                .toList()) {
            if (!p.getEnabled() || !p.getAction().equals(action)) {
                continue;
            }
            List<String> ids = readJson(p.getResourceIds());
            if (!ids.contains(toolId)) {
                continue;
            }
            if (p.getEffect() == PolicyEntity.Effect.DENY) {
                return "deny";
            }
            hasAllow = true;
        }
        return hasAllow ? "allow" : "inherit";
    }

    private boolean isPolicyEffective(PolicyEntity policy, Instant now) {
        if (!Boolean.TRUE.equals(policy.getEnabled())) {
            return false;
        }
        if (policy.getEffectiveStartAt() != null && now.isBefore(policy.getEffectiveStartAt())) {
            return false;
        }
        return policy.getEffectiveEndAt() == null || !now.isAfter(policy.getEffectiveEndAt());
    }

    private Map<String, String> resolveUserNames(Set<String> userIds) {
        if (CollectionUtils.isEmpty(userIds)) {
            return Collections.emptyMap();
        }
        List<UserEntity> users = userRepository.findAllById(userIds);
        return users.stream()
                .collect(Collectors.toMap(UserEntity::getId,
                        u -> firstNonBlank(u.getRealName(), u.getUsername(), u.getId()),
                        (a, b) -> a, LinkedHashMap::new));
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return "";
    }

    private PolicyEntity.SubjectType parseMatrixType(String type) {
        if ("user-tool".equals(type)) {
            return PolicyEntity.SubjectType.USER;
        }
        if ("app-tool".equals(type)) {
            return PolicyEntity.SubjectType.APP;
        }
        throw new IamException(ErrorCode.INVALID_FIELD_VALUE,
                "不支持的矩阵类型: " + type + "，仅支持 user-tool / app-tool");
    }

    private PolicyEntity.SubjectType parseSubjectType(String subjectType) {
        if (subjectType == null || subjectType.isBlank()) {
            return null;
        }
        try {
            return PolicyEntity.SubjectType.valueOf(subjectType.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IamException(ErrorCode.INVALID_FIELD_VALUE,
                    "不支持的 subjectType: " + subjectType);
        }
    }

    private String normalizeAction(String action) {
        return action == null ? DEFAULT_ACTION : action.toLowerCase();
    }

    private PolicyResponse toResponse(PolicyEntity e) {
        return PolicyResponse.builder()
                .id(e.getId())
                .name(e.getName())
                .subjectType(e.getSubjectType())
                .subjectId(e.getSubjectId())
                .resourceType(e.getResourceType())
                .resourceIds(readJson(e.getResourceIds()))
                .action(e.getAction())
                .effect(e.getEffect())
                .conditionExpression(e.getConditionExpression())
                .effectiveStartAt(e.getEffectiveStartAt())
                .effectiveEndAt(e.getEffectiveEndAt())
                .priority(e.getPriority())
                .enabled(e.getEnabled())
                .version(e.getVersion())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .createdBy(e.getCreatedBy())
                .updatedBy(e.getUpdatedBy())
                .build();
    }

    private String writeJson(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            log.warn("resourceIds 序列化失败，使用降级方案", e);
            return "[\"" + String.join("\",\"", list) + "\"]";
        }
    }

    private List<String> readJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (JsonProcessingException e) {
            log.warn("resourceIds 反序列化失败: {}", json, e);
            return Collections.emptyList();
        }
    }

    private String resolveTenantId(String requestTenantId) {
        return (requestTenantId == null || requestTenantId.isBlank()) ? "tenant-default" : requestTenantId;
    }

    private String currentOperator() {
        try {
            return CurrentUserHolder.requireUserId();
        } catch (IamException ex) {
            return "system";
        }
    }

    private byte[] exportXlsx(PolicyMatrixResponse matrix) {
        try (org.apache.poi.xssf.usermodel.XSSFWorkbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook()) {
            org.apache.poi.ss.usermodel.Sheet sheet = wb.createSheet("权限矩阵");
            org.apache.poi.ss.usermodel.Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("主体");
            List<MatrixColumnResponse> columns = matrix.getColumns();
            for (int i = 0; i < columns.size(); i++) {
                header.createCell(i + 1).setCellValue(columns.get(i).getToolId());
            }
            List<MatrixRowResponse> rows = matrix.getRows();
            for (int i = 0; i < rows.size(); i++) {
                MatrixRowResponse row = rows.get(i);
                org.apache.poi.ss.usermodel.Row r = sheet.createRow(i + 1);
                r.createCell(0).setCellValue(row.getSubject().getSubjectName());
                for (int j = 0; j < columns.size(); j++) {
                    String effect = row.getCells().get(columns.get(j).getToolId());
                    r.createCell(j + 1).setCellValue(effect == null ? "inherit" : effect);
                }
            }
            try (java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
                wb.write(out);
                return out.toByteArray();
            }
        } catch (IOException e) {
            throw new IamException(ErrorCode.INTERNAL_ERROR, "导出 Excel 失败: " + e.getMessage());
        }
    }

    private String exportCsv(PolicyMatrixResponse matrix) {
        StringWriter sw = new StringWriter();
        sw.write("\uFEFF"); // BOM for Excel
        sw.write("主体");
        for (MatrixColumnResponse col : matrix.getColumns()) {
            sw.write(',');
            sw.write(escapeCsv(col.getToolId()));
        }
        sw.write('\n');
        for (MatrixRowResponse row : matrix.getRows()) {
            sw.write(escapeCsv(row.getSubject().getSubjectName()));
            for (MatrixColumnResponse col : matrix.getColumns()) {
                sw.write(',');
                String effect = row.getCells().get(col.getToolId());
                sw.write(escapeCsv(effect == null ? "inherit" : effect));
            }
            sw.write('\n');
        }
        return sw.toString();
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
