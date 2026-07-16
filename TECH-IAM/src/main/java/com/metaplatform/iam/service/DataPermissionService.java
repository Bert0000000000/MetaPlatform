package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.dto.datapermission.CreateDataPermissionRequest;
import com.metaplatform.iam.dto.datapermission.DataPermissionResponse;
import com.metaplatform.iam.dto.datapermission.DataScopeResolveResponse;
import com.metaplatform.iam.dto.datapermission.UpdateDataPermissionRequest;
import com.metaplatform.iam.entity.DataPermissionEntity;
import com.metaplatform.iam.entity.DepartmentEntity;
import com.metaplatform.iam.entity.UserDepartmentEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.DataPermissionRepository;
import com.metaplatform.iam.repository.DepartmentRepository;
import com.metaplatform.iam.repository.UserDepartmentRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataPermissionService {

    private final DataPermissionRepository dataPermissionRepository;
    private final DepartmentRepository departmentRepository;
    private final UserDepartmentRepository userDepartmentRepository;
    private final ObjectMapper objectMapper;

    // ==================== CRUD ====================

    @Transactional
    public DataPermissionResponse create(CreateDataPermissionRequest request) {
        String tenantId = resolveTenantId(request.getTenantId());
        DataPermissionEntity.DataScope scope = request.getDataScope() == null
                ? DataPermissionEntity.DataScope.SELF : request.getDataScope();
        DataPermissionEntity.Effect effect = request.getEffect() == null
                ? DataPermissionEntity.Effect.ALLOW : request.getEffect();

        String resourceId = request.getResourceId();
        if (dataPermissionRepository.existsByTenantIdAndRoleIdAndResourceTypeAndResourceIdAndDeletedFalse(
                tenantId, request.getRoleId(), request.getResourceType(), resourceId)) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "数据权限规则已存在");
        }

        String operator = currentOperator();
        DataPermissionEntity entity = DataPermissionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .roleId(request.getRoleId())
                .resourceType(request.getResourceType())
                .resourceId(resourceId)
                .dataScope(scope)
                .columnFilter(writeJson(request.getColumnFilter()))
                .effect(effect)
                .deleted(false)
                .createdBy(operator)
                .updatedBy(operator)
                .version(1)
                .build();
        DataPermissionEntity saved = dataPermissionRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<DataPermissionResponse> list(String tenantId, String roleId, String resourceType) {
        String tid = resolveTenantId(tenantId);
        List<DataPermissionEntity> entities;
        if (roleId != null && !roleId.isBlank() && resourceType != null && !resourceType.isBlank()) {
            entities = dataPermissionRepository.findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(tid, roleId, resourceType);
        } else if (roleId != null && !roleId.isBlank()) {
            entities = dataPermissionRepository.findByTenantIdAndRoleIdAndDeletedFalse(tid, roleId);
        } else if (resourceType != null && !resourceType.isBlank()) {
            entities = dataPermissionRepository.findByTenantIdAndResourceTypeAndDeletedFalse(tid, resourceType);
        } else {
            entities = dataPermissionRepository.findByTenantIdAndDeletedFalse(tid);
        }
        return entities.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DataPermissionResponse get(String id) {
        DataPermissionEntity entity = dataPermissionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "数据权限规则不存在"));
        return toResponse(entity);
    }

    @Transactional
    public DataPermissionResponse update(String id, UpdateDataPermissionRequest request) {
        DataPermissionEntity entity = dataPermissionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "数据权限规则不存在"));
        if (!entity.getVersion().equals(request.getVersion())) {
            throw new IamException(ErrorCode.VERSION_CONFLICT, "数据权限版本不匹配");
        }
        if (request.getDataScope() != null) {
            entity.setDataScope(request.getDataScope());
        }
        if (request.getColumnFilter() != null) {
            entity.setColumnFilter(writeJson(request.getColumnFilter()));
        }
        if (request.getEffect() != null) {
            entity.setEffect(request.getEffect());
        }
        entity.setUpdatedBy(currentOperator());
        DataPermissionEntity saved = dataPermissionRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String id) {
        DataPermissionEntity entity = dataPermissionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "数据权限规则不存在"));
        entity.setDeleted(true);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        dataPermissionRepository.save(entity);
    }

    // ==================== 数据范围解析 ====================

    /**
     * 解析用户对某资源类型的实际数据范围。
     * 查询用户所有角色的数据权限规则，合并返回最宽松的 DataScope。
     *
     * @param userId      用户 ID
     * @param roleIds     用户拥有的角色 ID 列表
     * @param resourceType 资源类型
     * @return 合并后的数据范围（最宽松），无规则时默认 SELF
     */
    public DataPermissionEntity.DataScope resolveDataScope(List<String> roleIds, String resourceType) {
        if (roleIds == null || roleIds.isEmpty()) {
            return DataPermissionEntity.DataScope.SELF;
        }
        String tenantId = "tenant-default";
        List<DataPermissionEntity> all = new ArrayList<>();
        for (String roleId : roleIds) {
            all.addAll(dataPermissionRepository
                    .findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(tenantId, roleId, resourceType));
        }
        // 只考虑 ALLOW 规则；DENY 规则不参与数据范围合并
        List<DataPermissionEntity.DataScope> scopes = all.stream()
                .filter(e -> e.getEffect() == DataPermissionEntity.Effect.ALLOW)
                .map(DataPermissionEntity::getDataScope)
                .toList();
        if (scopes.isEmpty()) {
            return DataPermissionEntity.DataScope.SELF;
        }
        // 合并取最宽松：ALL > DEPT_AND_SUB > DEPT > SELF
        return scopes.stream().reduce(DataPermissionEntity.DataScope.SELF, this::widerScope);
    }

    /**
     * 合并所有列级过滤配置（取并集）。
     *
     * @param roleIds      用户拥有的角色 ID 列表
     * @param resourceType 资源类型
     * @return 合并后的列级过滤字段列表
     */
    public List<String> resolveColumnFilter(List<String> roleIds, String resourceType) {
        if (roleIds == null || roleIds.isEmpty()) {
            return Collections.emptyList();
        }
        String tenantId = "tenant-default";
        Set<String> merged = new HashSet<>();
        for (String roleId : roleIds) {
            List<DataPermissionEntity> rules = dataPermissionRepository
                    .findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(tenantId, roleId, resourceType);
            for (DataPermissionEntity rule : rules) {
                if (rule.getEffect() == DataPermissionEntity.Effect.ALLOW) {
                    merged.addAll(readJson(rule.getColumnFilter()));
                }
            }
        }
        return new ArrayList<>(merged);
    }

    /**
     * 根据 DataScope 生成 SQL WHERE 子句。
     * - ALL: 不加过滤
     * - DEPT: WHERE dept_id IN (用户所属部门)
     * - DEPT_AND_SUB: WHERE dept_id IN (用户所属部门及子部门)
     * - SELF: WHERE created_by = userId
     *
     * @param dataScope 数据范围
     * @param userId    用户 ID
     * @return SQL WHERE 子句（不含 "WHERE" 关键字），ALL 时返回空字符串
     */
    public String applyRowFilter(DataPermissionEntity.DataScope dataScope, String userId) {
        if (dataScope == null) {
            return "created_by = '" + userId + "'";
        }
        return switch (dataScope) {
            case ALL -> "";
            case SELF -> "created_by = '" + userId + "'";
            case DEPT -> {
                List<String> deptIds = getUserDeptIds(userId);
                if (deptIds.isEmpty()) {
                    yield "created_by = '" + userId + "'";
                }
                yield "dept_id IN ('" + String.join("','", deptIds) + "')";
            }
            case DEPT_AND_SUB -> {
                List<String> deptIds = getUserDeptAndSubDeptIds(userId);
                if (deptIds.isEmpty()) {
                    yield "created_by = '" + userId + "'";
                }
                yield "dept_id IN ('" + String.join("','", deptIds) + "')";
            }
        };
    }

    /**
     * 完整解析：返回数据范围 + 行级过滤 SQL + 列级过滤字段。
     */
    public DataScopeResolveResponse resolve(String userId, List<String> roleIds, String resourceType) {
        DataPermissionEntity.DataScope scope = resolveDataScope(roleIds, resourceType);
        String rowFilter = applyRowFilter(scope, userId);
        List<String> columnFilter = resolveColumnFilter(roleIds, resourceType);
        return DataScopeResolveResponse.builder()
                .userId(userId)
                .resourceType(resourceType)
                .dataScope(scope)
                .rowFilter(rowFilter)
                .columnFilter(columnFilter)
                .build();
    }

    // ==================== 内部辅助 ====================

    private DataPermissionEntity.DataScope widerScope(DataPermissionEntity.DataScope a,
                                                       DataPermissionEntity.DataScope b) {
        int ra = rank(a);
        int rb = rank(b);
        return ra >= rb ? a : b;
    }

    private int rank(DataPermissionEntity.DataScope scope) {
        return switch (scope) {
            case ALL -> 4;
            case DEPT_AND_SUB -> 3;
            case DEPT -> 2;
            case SELF -> 1;
        };
    }

    private List<String> getUserDeptIds(String userId) {
        return userDepartmentRepository.findByUserIdAndDeletedFalse(userId).stream()
                .map(UserDepartmentEntity::getDepartmentId)
                .toList();
    }

    private List<String> getUserDeptAndSubDeptIds(String userId) {
        List<UserDepartmentEntity> userDepts = userDepartmentRepository.findByUserIdAndDeletedFalse(userId);
        if (userDepts.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> result = new HashSet<>();
        for (UserDepartmentEntity ud : userDepts) {
            String deptId = ud.getDepartmentId();
            result.add(deptId);
            // 查询该部门下的所有子部门（通过 parentId 递归）
            collectSubDepts(deptId, result);
        }
        return new ArrayList<>(result);
    }

    private void collectSubDepts(String parentId, Set<String> acc) {
        List<DepartmentEntity> children = departmentRepository
                .findByTenantIdAndParentIdAndDeletedFalse("tenant-default", parentId);
        for (DepartmentEntity child : children) {
            if (acc.add(child.getId())) {
                collectSubDepts(child.getId(), acc);
            }
        }
    }

    private String writeJson(List<String> list) {
        if (list == null || list.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            log.warn("column_filter 序列化失败，使用降级方案", e);
            return "[\"" + String.join("\",\"", list) + "\"]";
        }
    }

    private List<String> readJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, String.class));
        } catch (JsonProcessingException e) {
            log.warn("column_filter 反序列化失败: {}", json, e);
            return Collections.emptyList();
        }
    }

    private DataPermissionResponse toResponse(DataPermissionEntity e) {
        return DataPermissionResponse.builder()
                .dataPermissionId(e.getId())
                .roleId(e.getRoleId())
                .resourceType(e.getResourceType())
                .resourceId(e.getResourceId())
                .dataScope(e.getDataScope())
                .columnFilter(readJson(e.getColumnFilter()))
                .effect(e.getEffect())
                .version(e.getVersion())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .createdBy(e.getCreatedBy())
                .updatedBy(e.getUpdatedBy())
                .build();
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
}
