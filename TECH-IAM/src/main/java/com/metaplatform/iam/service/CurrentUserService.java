package com.metaplatform.iam.service;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.dto.auth.CurrentUserResponse;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CurrentUserService {

    private final UserRepository userRepository;
    private final UserDepartmentService userDepartmentService;

    @Transactional(readOnly = true)
    public CurrentUserResponse current() {
        String userId = CurrentUserHolder.requireUserId();
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "用户不存在"));

        // Phase 2：从 JWT claims 中获取角色；权限聚合查询放到 Sprint 4 与 user_role 关联表一并实现
        List<String> roles = CurrentUserHolder.getRolesOrEmpty();
        List<CurrentUserResponse.PermissionSummary> permissions = Collections.emptyList();

        List<CurrentUserResponse.DepartmentSummary> departments = userDepartmentService.listByUser(userId).stream()
                .map(ud -> CurrentUserResponse.DepartmentSummary.builder()
                        .departmentId(ud.getDepartmentId())
                        .departmentCode(ud.getDepartmentCode())
                        .departmentName(ud.getDepartmentName())
                        .isPrimary(ud.getIsPrimary())
                        .build())
                .toList();

        return CurrentUserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .realName(user.getRealName())
                .tenantId(user.getTenantId())
                .roles(roles)
                .permissions(permissions)
                .departments(departments)
                .build();
    }
}