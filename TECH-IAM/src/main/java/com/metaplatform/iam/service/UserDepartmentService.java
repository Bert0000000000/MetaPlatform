package com.metaplatform.iam.service;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.dto.userdepartment.UserDepartmentAssignmentRequest;
import com.metaplatform.iam.dto.userdepartment.UserDepartmentResponse;
import com.metaplatform.iam.entity.DepartmentEntity;
import com.metaplatform.iam.entity.UserDepartmentEntity;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.DepartmentRepository;
import com.metaplatform.iam.repository.UserDepartmentRepository;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserDepartmentService {

    private final UserDepartmentRepository userDepartmentRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;

    @Transactional
    public UserDepartmentResponse assign(String userId, UserDepartmentAssignmentRequest request) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "用户不存在"));
        DepartmentEntity department = departmentRepository.findByIdAndDeletedFalse(request.getDepartmentId())
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "部门不存在"));

        String operator = currentOperator();
        boolean wantPrimary = Boolean.TRUE.equals(request.getIsPrimary());
        UserDepartmentEntity link = userDepartmentRepository
                .findByUserIdAndDepartmentIdAndDeletedFalse(userId, request.getDepartmentId())
                .orElse(null);
        if (link == null) {
            link = UserDepartmentEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(user.getTenantId())
                    .userId(userId)
                    .departmentId(request.getDepartmentId())
                    .isPrimary(wantPrimary)
                    .deleted(false)
                    .createdBy(operator)
                    .updatedBy(operator)
                    .version(1)
                    .build();
        } else {
            if (wantPrimary) {
                link.setIsPrimary(true);
            }
            link.setUpdatedBy(operator);
        }
        if (wantPrimary) {
            // 确保一个用户只有一个主部门
            userDepartmentRepository.findByUserIdAndDeletedFalse(userId).stream()
                    .filter(ud -> Boolean.TRUE.equals(ud.getIsPrimary()) && !ud.getDepartmentId().equals(request.getDepartmentId()))
                    .forEach(ud -> {
                        ud.setIsPrimary(false);
                        ud.setUpdatedBy(operator);
                        userDepartmentRepository.save(ud);
                    });
        }
        UserDepartmentEntity saved = userDepartmentRepository.save(link);
        return toResponse(saved, department.getDeptName(), department.getDeptCode());
    }

    @Transactional(readOnly = true)
    public List<UserDepartmentResponse> listByUser(String userId) {
        if (!userRepository.existsById(userId)) {
            throw new IamException(ErrorCode.NOT_FOUND, "用户不存在");
        }
        List<UserDepartmentEntity> links = userDepartmentRepository.findByUserIdAndDeletedFalse(userId);
        if (links.isEmpty()) {
            return List.of();
        }
        List<String> deptIds = links.stream().map(UserDepartmentEntity::getDepartmentId).toList();
        Map<String, DepartmentEntity> deptMap = new HashMap<>();
        departmentRepository.findAllById(deptIds).forEach(d -> deptMap.put(d.getId(), d));
        List<UserDepartmentResponse> result = new ArrayList<>();
        for (UserDepartmentEntity link : links) {
            DepartmentEntity dept = deptMap.get(link.getDepartmentId());
            result.add(toResponse(link,
                    dept == null ? null : dept.getDeptName(),
                    dept == null ? null : dept.getDeptCode()));
        }
        return result;
    }

    private UserDepartmentResponse toResponse(UserDepartmentEntity ud, String deptName, String deptCode) {
        return UserDepartmentResponse.builder()
                .id(ud.getId())
                .userId(ud.getUserId())
                .departmentId(ud.getDepartmentId())
                .departmentName(deptName)
                .departmentCode(deptCode)
                .positionId(ud.getPositionId())
                .isPrimary(ud.getIsPrimary())
                .createdAt(ud.getCreatedAt())
                .createdBy(ud.getCreatedBy())
                .build();
    }

    private String currentOperator() {
        try {
            return CurrentUserHolder.requireUserId();
        } catch (IamException ex) {
            return "system";
        }
    }
}