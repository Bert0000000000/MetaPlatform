package com.metaplatform.iam.service;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.department.CreateDepartmentRequest;
import com.metaplatform.iam.dto.department.DepartmentResponse;
import com.metaplatform.iam.dto.department.UpdateDepartmentRequest;
import com.metaplatform.iam.entity.DepartmentEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.DepartmentRepository;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DepartmentService {

    private static final int MAX_DEPTH = 10;

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;

    @Transactional
    public DepartmentResponse create(CreateDepartmentRequest request) {
        String tenantId = resolveTenantId(request.getTenantId());
        if (departmentRepository.existsByTenantIdAndDeptCodeAndDeletedFalse(tenantId, request.getDeptCode())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "部门编码在该租户下已存在");
        }
        String parentId = request.getParentId();
        DepartmentEntity parent = null;
        int level = 1;
        String parentPath = "";
        if (parentId != null && !parentId.isBlank()) {
            parent = departmentRepository.findByIdAndDeletedFalse(parentId)
                    .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "上级部门不存在"));
            level = parent.getLevel() + 1;
            parentPath = parent.getParentPath() == null ? "" : parent.getParentPath();
            if (level > MAX_DEPTH) {
                throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "部门层级超过最大深度（默认 10 层）");
            }
        }
        String operator = currentOperator();
        DepartmentEntity entity = DepartmentEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .deptCode(request.getDeptCode())
                .deptName(request.getDeptName())
                .parentId(parentId)
                .parentPath(parentPath)
                .fullPath(buildFullPath(parent, request.getDeptName()))
                .level(level)
                .sortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder())
                .leaderId(request.getLeaderId())
                .description(request.getDescription())
                .deleted(false)
                .createdBy(operator)
                .updatedBy(operator)
                .version(1)
                .build();
        DepartmentEntity saved = departmentRepository.save(entity);
        return toResponse(saved, parent == null ? null : parent.getDeptName(), 0L, 0L);
    }

    @Transactional(readOnly = true)
    public PageResponse<DepartmentResponse> list(String tenantId,
                                                 String parentId,
                                                 String keyword,
                                                 Integer page,
                                                 Integer size) {
        String tid = resolveTenantId(tenantId);
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.ASC, "sortOrder", "id"));

        Page<DepartmentEntity> result;
        boolean hasKeyword = keyword != null && !keyword.isBlank();
        if (parentId != null && !parentId.isBlank() && hasKeyword) {
            result = departmentRepository.searchByParentAndKeyword(tid, parentId, keyword.trim(), pageable);
        } else if (parentId != null && !parentId.isBlank()) {
            result = departmentRepository.findByTenantIdAndParentIdAndDeletedFalse(tid, parentId, pageable);
        } else if (hasKeyword) {
            result = departmentRepository.searchByKeyword(tid, keyword.trim(), pageable);
        } else {
            result = departmentRepository.findByTenantIdAndDeletedFalse(tid, pageable);
        }

        List<DepartmentResponse> items = result.getContent().stream()
                .map(this::toListResponse)
                .toList();
        return PageResponse.<DepartmentResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public DepartmentResponse get(String id) {
        DepartmentEntity entity = departmentRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "部门不存在"));
        String parentName = null;
        if (entity.getParentId() != null) {
            parentName = departmentRepository.findByIdAndDeletedFalse(entity.getParentId())
                    .map(DepartmentEntity::getDeptName)
                    .orElse(null);
        }
        long childCount = departmentRepository.countByParentIdAndDeletedFalse(id);
        return toResponse(entity, parentName, childCount, 0L);
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> tree(String tenantId, String rootId) {
        String tid = resolveTenantId(tenantId);
        List<DepartmentEntity> all = departmentRepository.findAll().stream()
                .filter(e -> tid.equals(e.getTenantId()))
                .filter(e -> !Boolean.TRUE.equals(e.getDeleted()))
                .toList();
        Map<String, List<DepartmentEntity>> childrenMap = new HashMap<>();
        for (DepartmentEntity e : all) {
            String pid = e.getParentId() == null ? "" : e.getParentId();
            childrenMap.computeIfAbsent(pid, k -> new ArrayList<>()).add(e);
        }
        List<DepartmentEntity> roots;
        if (rootId != null && !rootId.isBlank()) {
            DepartmentEntity root = all.stream()
                    .filter(e -> rootId.equals(e.getId()))
                    .findFirst()
                    .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "根部门不存在"));
            roots = List.of(root);
        } else {
            roots = childrenMap.getOrDefault("", List.of());
        }
        return roots.stream().map(r -> buildTree(r, childrenMap)).toList();
    }

    @Transactional
    public DepartmentResponse update(String id, UpdateDepartmentRequest request) {
        DepartmentEntity entity = departmentRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "部门不存在"));
        if (!entity.getVersion().equals(request.getVersion())) {
            throw new IamException(ErrorCode.VERSION_CONFLICT, "部门版本不匹配");
        }
        if (request.getDeptName() != null) {
            entity.setDeptName(request.getDeptName());
        }
        if (request.getSortOrder() != null) {
            entity.setSortOrder(request.getSortOrder());
        }
        if (request.getLeaderId() != null) {
            entity.setLeaderId(request.getLeaderId());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getParentId() != null && !request.getParentId().equals(entity.getParentId())) {
            if (request.getParentId().equals(id)) {
                throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "不能将部门移动到自身下");
            }
            DepartmentEntity parent = departmentRepository.findByIdAndDeletedFalse(request.getParentId())
                    .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "上级部门不存在"));
            // 防止循环引用：不能移动到自身子部门下
            if (isDescendant(parent, id)) {
                throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION,
                        "不能将部门移动到其子部门下（会造成循环引用）");
            }
            entity.setParentId(parent.getId());
            entity.setParentPath(parent.getParentPath());
            entity.setLevel(parent.getLevel() + 1);
            entity.setFullPath(buildFullPath(parent, entity.getDeptName()));
        }
        entity.setUpdatedBy(currentOperator());
        DepartmentEntity saved = departmentRepository.save(entity);
        String parentName = saved.getParentId() == null ? null
                : departmentRepository.findByIdAndDeletedFalse(saved.getParentId())
                .map(DepartmentEntity::getDeptName).orElse(null);
        return toResponse(saved, parentName, departmentRepository.countByParentIdAndDeletedFalse(id), 0L);
    }

    @Transactional
    public void softDelete(String id) {
        DepartmentEntity entity = departmentRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "部门不存在"));
        long childCount = departmentRepository.countByParentIdAndDeletedFalse(id);
        if (childCount > 0) {
            throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION,
                    "存在子部门，不可直接删除（请先处理子部门）");
        }
        if (entity.getParentId() == null) {
            throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "不可删除根部门");
        }
        entity.setDeleted(true);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        departmentRepository.save(entity);
    }

    private boolean isDescendant(DepartmentEntity candidate, String ancestorId) {
        String pid = candidate.getParentId();
        while (pid != null) {
            if (ancestorId.equals(pid)) {
                return true;
            }
            Optional<DepartmentEntity> next = departmentRepository.findByIdAndDeletedFalse(pid);
            if (next.isEmpty()) {
                return false;
            }
            pid = next.get().getParentId();
        }
        return false;
    }

    private DepartmentResponse toListResponse(DepartmentEntity e) {
        return toResponse(e, null, null, null);
    }

    private DepartmentResponse toResponse(DepartmentEntity e, String parentName, Long childCount, Long memberCount) {
        DepartmentResponse.Leader leader = null;
        if (e.getLeaderId() != null) {
            leader = userRepository.findById(e.getLeaderId())
                    .map(u -> DepartmentResponse.Leader.builder()
                            .userId(u.getId())
                            .realName(u.getRealName())
                            .username(u.getUsername())
                            .build())
                    .orElse(null);
        }
        return DepartmentResponse.builder()
                .deptId(e.getId())
                .deptCode(e.getDeptCode())
                .deptName(e.getDeptName())
                .parentId(e.getParentId())
                .parentName(parentName)
                .parentPath(e.getParentPath())
                .fullPath(e.getFullPath())
                .level(e.getLevel())
                .sortOrder(e.getSortOrder())
                .leader(leader)
                .memberCount(memberCount == null ? 0L : memberCount)
                .childCount(childCount == null ? 0L : childCount)
                .description(e.getDescription())
                .version(e.getVersion())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .createdBy(e.getCreatedBy())
                .updatedBy(e.getUpdatedBy())
                .build();
    }

    private DepartmentResponse buildTree(DepartmentEntity node,
                                        Map<String, List<DepartmentEntity>> childrenMap) {
        List<DepartmentEntity> children = childrenMap.getOrDefault(node.getId(), List.of());
        List<DepartmentResponse> childResponses = children.stream()
                .map(c -> buildTree(c, childrenMap))
                .toList();
        DepartmentResponse response = toResponse(node, null, (long) childResponses.size(), 0L);
        response.setChildren(childResponses);
        return response;
    }

    private String buildFullPath(DepartmentEntity parent, String deptName) {
        if (parent == null) {
            return "/" + deptName;
        }
        return parent.getFullPath() + "/" + deptName;
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