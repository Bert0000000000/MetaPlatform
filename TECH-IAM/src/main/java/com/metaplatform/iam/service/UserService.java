package com.metaplatform.iam.service;

import com.metaplatform.iam.audit.entity.IamAuditLogEntity;
import com.metaplatform.iam.audit.service.AuditLogService;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.user.CreateUserRequest;
import com.metaplatform.iam.dto.user.PasswordChangeRequest;
import com.metaplatform.iam.dto.user.PasswordResetRequest;
import com.metaplatform.iam.dto.user.UpdateUserRequest;
import com.metaplatform.iam.dto.user.UserResponse;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.entity.UserDepartmentEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private static final String DEFAULT_TENANT_ID = "tenant-default";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> list(String tenantId, String keyword, String status,
                                           String departmentId, Integer page, Integer size) {
        String tid = resolveTenantId(tenantId);
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "createdAt"));

        UserEntity.UserStatus statusEnum = parseStatus(status);
        String kw = (keyword == null || keyword.isBlank()) ? null : keyword.trim();

        Specification<UserEntity> spec = buildSearchSpec(tid, statusEnum, kw, departmentId);
        Page<UserEntity> result = userRepository.findAll(spec, pageable);
        var items = result.getContent().stream().map(this::toResponse).toList();
        return PageResponse.<UserResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    private Specification<UserEntity> buildSearchSpec(String tenantId, UserEntity.UserStatus status,
                                                     String keyword, String departmentId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (tenantId != null) {
                predicates.add(cb.equal(root.get("tenantId"), tenantId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (keyword != null) {
                String like = "%" + keyword.toLowerCase() + "%";
                Predicate usernameLike = cb.like(cb.lower(root.get("username")), like);
                Predicate emailLike = cb.like(cb.lower(root.get("email")), like);
                Predicate realNameLike = cb.like(cb.lower(cb.coalesce(root.get("realName"), "")), like);
                Predicate phoneLike = cb.like(cb.lower(cb.coalesce(root.get("phone"), "")), like);
                predicates.add(cb.or(usernameLike, emailLike, realNameLike, phoneLike));
            }
            if (departmentId != null) {
                // EXISTS 子查询：用户在指定部门下
                var subquery = query.subquery(Integer.class);
                var subRoot = subquery.from(UserDepartmentEntity.class);
                subquery.select(cb.literal(1))
                        .where(cb.and(
                                cb.equal(subRoot.get("userId"), root.get("id")),
                                cb.equal(subRoot.get("departmentId"), departmentId)));
                predicates.add(cb.exists(subquery));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Transactional(readOnly = true)
    public UserResponse getById(String userId) {
        return toResponse(findUser(userId));
    }

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        validatePassword(request.getPassword());
        String tenantId = resolveTenantId(request.getTenantId());
        if (userRepository.existsByTenantIdAndUsername(tenantId, request.getUsername())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "用户名在该租户下已存在");
        }
        if (userRepository.existsByTenantIdAndEmail(tenantId, request.getEmail())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "邮箱在该租户下已存在");
        }

        UserEntity user = UserEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .realName(request.getRealName())
                .phone(request.getPhone())
                .avatarUrl(request.getAvatarUrl())
                .status(UserEntity.UserStatus.ENABLED)
                .requirePasswordReset(true)
                .build();
        UserEntity saved = userRepository.save(user);
        audit(saved.getTenantId(), saved.getId(), IamAuditLogEntity.Action.CREATE,
                "User", saved.getId(), "创建用户: " + saved.getUsername());
        return toResponse(saved);
    }

    @Transactional
    public UserResponse update(String userId, UpdateUserRequest request) {
        UserEntity user = findUser(userId);
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            if (!request.getEmail().equalsIgnoreCase(user.getEmail())
                    && userRepository.existsByTenantIdAndEmail(user.getTenantId(), request.getEmail())) {
                throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "邮箱已存在");
            }
            user.setEmail(request.getEmail());
        }
        if (request.getRealName() != null) {
            user.setRealName(request.getRealName());
        }
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl());
        }
        UserEntity saved = userRepository.save(user);
        audit(saved.getTenantId(), saved.getId(), IamAuditLogEntity.Action.UPDATE,
                "User", saved.getId(), "更新用户: " + saved.getUsername());
        return toResponse(saved);
    }

    @Transactional
    public void delete(String userId) {
        UserEntity user = findUser(userId);
        userRepository.delete(user);
        audit(user.getTenantId(), user.getId(), IamAuditLogEntity.Action.DELETE,
                "User", user.getId(), "删除用户: " + user.getUsername());
    }

    @Transactional
    public UserResponse updateStatus(String userId, String status) {
        UserEntity user = findUser(userId);
        user.setStatus(parseStatus(status));
        UserEntity saved = userRepository.save(user);
        audit(saved.getTenantId(), saved.getId(), IamAuditLogEntity.Action.UPDATE,
                "User", saved.getId(), "更新用户状态为: " + status);
        return toResponse(saved);
    }

    @Transactional
    public void resetPassword(String userId, PasswordResetRequest request) {
        validatePassword(request.getNewPassword());
        UserEntity user = findUser(userId);
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setRequirePasswordReset(true);
        userRepository.save(user);
        audit(user.getTenantId(), user.getId(), IamAuditLogEntity.Action.UPDATE,
                "User", user.getId(), "管理员重置用户密码: " + user.getUsername());
    }

    @Transactional
    public void changePassword(String userId, PasswordChangeRequest request) {
        validatePassword(request.getNewPassword());
        UserEntity user = findUser(userId);
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new IamException(ErrorCode.INVALID_CREDENTIALS, "旧密码不正确");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setRequirePasswordReset(false);
        userRepository.save(user);
        audit(user.getTenantId(), user.getId(), IamAuditLogEntity.Action.UPDATE,
                "User", user.getId(), "用户修改密码: " + user.getUsername());
    }

    @Transactional
    public UserResponse uploadAvatar(String userId, String avatarUrl) {
        UserEntity user = findUser(userId);
        user.setAvatarUrl(avatarUrl);
        UserEntity saved = userRepository.save(user);
        audit(saved.getTenantId(), saved.getId(), IamAuditLogEntity.Action.UPDATE,
                "User", saved.getId(), "更新用户头像: " + saved.getUsername());
        return toResponse(saved);
    }

    private UserEntity findUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IamException(ErrorCode.USER_NOT_FOUND, "用户不存在: " + userId));
    }

    private UserResponse toResponse(UserEntity u) {
        return UserResponse.builder()
                .id(u.getId())
                .tenantId(u.getTenantId())
                .username(u.getUsername())
                .email(u.getEmail())
                .realName(u.getRealName())
                .phone(u.getPhone())
                .avatarUrl(u.getAvatarUrl())
                .status(u.getStatus().name())
                .requirePasswordReset(u.getRequirePasswordReset())
                .lastLoginAt(u.getLastLoginAt())
                .createdAt(u.getCreatedAt())
                .updatedAt(u.getUpdatedAt())
                .build();
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 64) {
            throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "密码长度必须在 8-64 位之间");
        }
        int categoryCount = 0;
        if (Pattern.compile("[A-Z]").matcher(password).find()) categoryCount++;
        if (Pattern.compile("[a-z]").matcher(password).find()) categoryCount++;
        if (Pattern.compile("[0-9]").matcher(password).find()) categoryCount++;
        if (Pattern.compile("[^A-Za-z0-9]").matcher(password).find()) categoryCount++;
        if (categoryCount < 3) {
            throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "密码必须包含大写字母、小写字母、数字、特殊字符中的至少 3 类");
        }
    }

    private UserEntity.UserStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return UserEntity.UserStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IamException(ErrorCode.INVALID_FIELD_VALUE, "无效的用户状态: " + status);
        }
    }

    private String resolveTenantId(String requestTenantId) {
        return (requestTenantId == null || requestTenantId.isBlank()) ? DEFAULT_TENANT_ID : requestTenantId;
    }

    private void audit(String tenantId, String userId, IamAuditLogEntity.Action action,
                       String resourceType, String resourceId, String description) {
        auditLogService.record(tenantId, userId, action, resourceType, resourceId,
                description, IamAuditLogEntity.Status.SUCCESS, null);
    }
}
