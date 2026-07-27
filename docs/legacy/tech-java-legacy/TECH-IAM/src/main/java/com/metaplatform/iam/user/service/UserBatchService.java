package com.metaplatform.iam.user.service;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.dto.user.BatchAssignPositionRequest;
import com.metaplatform.iam.dto.user.BatchAssignResponse;
import com.metaplatform.iam.dto.user.BatchAssignRoleRequest;
import com.metaplatform.iam.dto.user.BatchImportUsersRequest;
import com.metaplatform.iam.dto.user.BatchImportUsersResponse;
import com.metaplatform.iam.entity.DepartmentEntity;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.entity.UserRoleEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.position.entity.UserPositionEntity;
import com.metaplatform.iam.position.repository.UserPositionRepository;
import com.metaplatform.iam.repository.DepartmentRepository;
import com.metaplatform.iam.repository.RoleRepository;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.repository.UserRoleRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserBatchService {

    private static final String DEFAULT_TENANT_ID = "tenant-default";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final DepartmentRepository departmentRepository;
    private final UserPositionRepository userPositionRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public BatchImportUsersResponse batchImport(BatchImportUsersRequest request) {
        List<BatchImportUsersRequest.RegisterEntry> entries = resolveEntries(request);
        List<BatchImportUsersResponse.ImportResult> results = new ArrayList<>();
        int success = 0;
        int failed = 0;
        for (int i = 0; i < entries.size(); i++) {
            BatchImportUsersRequest.RegisterEntry entry = entries.get(i);
            BatchImportUsersResponse.ImportResult result = BatchImportUsersResponse.ImportResult.builder()
                    .index(i)
                    .username(entry.getUsername())
                    .build();
            try {
                UserEntity user = importOne(entry);
                result.setUserId(user.getId());
                result.setSuccess(true);
                success++;
            } catch (Exception e) {
                result.setSuccess(false);
                result.setErrorMessage(e.getMessage());
                failed++;
            }
            results.add(result);
        }
        return BatchImportUsersResponse.builder()
                .totalCount(entries.size())
                .successCount(success)
                .failedCount(failed)
                .results(results)
                .build();
    }

    private UserEntity importOne(BatchImportUsersRequest.RegisterEntry entry) {
        if (entry.getUsername() == null || entry.getUsername().isBlank()) {
            throw new IamException(ErrorCode.INVALID_PARAM, "用户名不能为空");
        }
        if (entry.getEmail() == null || entry.getEmail().isBlank()) {
            throw new IamException(ErrorCode.INVALID_PARAM, "邮箱不能为空");
        }
        if (entry.getPassword() == null || entry.getPassword().length() < 8) {
            throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "密码长度必须 >= 8");
        }
        String tenantId = DEFAULT_TENANT_ID;
        if (userRepository.existsByTenantIdAndUsername(tenantId, entry.getUsername())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "用户名已存在: " + entry.getUsername());
        }
        if (userRepository.existsByTenantIdAndEmail(tenantId, entry.getEmail())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "邮箱已存在: " + entry.getEmail());
        }
        UserEntity user = UserEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .username(entry.getUsername())
                .email(entry.getEmail())
                .passwordHash(passwordEncoder.encode(entry.getPassword()))
                .realName(entry.getRealName())
                .phone(entry.getPhone())
                .status(UserEntity.UserStatus.ENABLED)
                .requirePasswordReset(true)
                .build();
        UserEntity saved = userRepository.save(user);
        if (entry.getDepartmentId() != null && !entry.getDepartmentId().isBlank()) {
            DepartmentEntity dept = departmentRepository.findByIdAndDeletedFalse(entry.getDepartmentId())
                    .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND,
                            "部门不存在: " + entry.getDepartmentId()));
            // 通过 UserPosition 关联，承载 positionId（可空）
            userPositionRepository.save(UserPositionEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .userId(saved.getId())
                    .positionId(entry.getPositionId() == null ? "" : entry.getPositionId())
                    .departmentId(dept.getId())
                    .isPrimary(true)
                    .startDate(LocalDate.now())
                    .deleted(false)
                    .version(1)
                    .build());
        }
        return saved;
    }

    @Transactional
    public BatchAssignResponse batchAssignRole(BatchAssignRoleRequest request) {
        if (!roleRepository.existsById(request.getRoleId())) {
            throw new IamException(ErrorCode.NOT_FOUND, "角色不存在");
        }
        List<BatchAssignResponse.AssignResult> results = new ArrayList<>();
        int success = 0;
        int failed = 0;
        for (String userId : request.getUserIds()) {
            BatchAssignResponse.AssignResult result = BatchAssignResponse.AssignResult.builder()
                    .userId(userId).build();
            try {
                Optional<UserEntity> user = userRepository.findById(userId);
                if (user.isEmpty()) {
                    throw new IamException(ErrorCode.NOT_FOUND, "用户不存在: " + userId);
                }
                if (!userRoleRepository.existsByUserIdAndRoleIdAndDeletedFalse(userId, request.getRoleId())) {
                    userRoleRepository.save(UserRoleEntity.builder()
                            .id(UUID.randomUUID().toString())
                            .tenantId(user.get().getTenantId())
                            .userId(userId)
                            .roleId(request.getRoleId())
                            .deleted(false)
                            .createdBy(currentOperator())
                            .updatedBy(currentOperator())
                            .version(1)
                            .build());
                }
                result.setSuccess(true);
                success++;
            } catch (Exception e) {
                result.setSuccess(false);
                result.setErrorMessage(e.getMessage());
                failed++;
            }
            results.add(result);
        }
        return BatchAssignResponse.builder()
                .totalCount(request.getUserIds().size())
                .successCount(success)
                .failedCount(failed)
                .results(results)
                .build();
    }

    @Transactional
    public BatchAssignResponse batchAssignPosition(BatchAssignPositionRequest request) {
        if (!departmentRepository.existsById(request.getDepartmentId())) {
            throw new IamException(ErrorCode.NOT_FOUND, "部门不存在");
        }
        boolean isPrimary = Boolean.TRUE.equals(request.getIsPrimary());
        List<BatchAssignResponse.AssignResult> results = new ArrayList<>();
        int success = 0;
        int failed = 0;
        for (String userId : request.getUserIds()) {
            BatchAssignResponse.AssignResult result = BatchAssignResponse.AssignResult.builder()
                    .userId(userId).build();
            try {
                Optional<UserEntity> user = userRepository.findById(userId);
                if (user.isEmpty()) {
                    throw new IamException(ErrorCode.NOT_FOUND, "用户不存在: " + userId);
                }
                Optional<UserPositionEntity> existing = userPositionRepository
                        .findByUserIdAndPositionIdAndDepartmentIdAndDeletedFalse(
                                userId, request.getPositionId(), request.getDepartmentId());
                if (existing.isPresent()) {
                    result.setSuccess(true);
                    success++;
                    continue;
                }
                if (isPrimary) {
                    long primaryCount = userPositionRepository.countByUserIdAndIsPrimaryTrueAndDeletedFalse(userId);
                    if (primaryCount == 0) {
                        isPrimary = true;
                    }
                }
                userPositionRepository.save(UserPositionEntity.builder()
                        .id(UUID.randomUUID().toString())
                        .tenantId(user.get().getTenantId())
                        .userId(userId)
                        .positionId(request.getPositionId())
                        .departmentId(request.getDepartmentId())
                        .isPrimary(isPrimary)
                        .startDate(LocalDate.now())
                        .deleted(false)
                        .createdBy(currentOperator())
                        .updatedBy(currentOperator())
                        .version(1)
                        .build());
                result.setSuccess(true);
                success++;
            } catch (Exception e) {
                result.setSuccess(false);
                result.setErrorMessage(e.getMessage());
                failed++;
            }
            results.add(result);
        }
        return BatchAssignResponse.builder()
                .totalCount(request.getUserIds().size())
                .successCount(success)
                .failedCount(failed)
                .results(results)
                .build();
    }

    private List<BatchImportUsersRequest.RegisterEntry> resolveEntries(BatchImportUsersRequest request) {
        if (request.getUsers() != null && !request.getUsers().isEmpty()) {
            return request.getUsers();
        }
        if (request.getCsvData() != null && !request.getCsvData().isBlank()) {
            return parseCsv(request.getCsvData());
        }
        throw new IamException(ErrorCode.INVALID_PARAM, "users 或 csvData 至少需要提供一个");
    }

    private List<BatchImportUsersRequest.RegisterEntry> parseCsv(String csv) {
        List<BatchImportUsersRequest.RegisterEntry> result = new ArrayList<>();
        String[] lines = csv.split("\\r?\\n");
        boolean first = true;
        for (String line : lines) {
            if (line == null || line.isBlank()) continue;
            if (first) {
                first = false;
                // Skip header if detected
                if (line.toLowerCase().contains("username")) continue;
            }
            String[] parts = splitCsvLine(line);
            if (parts.length < 2) continue;
            BatchImportUsersRequest.RegisterEntry e = new BatchImportUsersRequest.RegisterEntry();
            e.setUsername(parts[0].trim());
            e.setEmail(parts[1].trim());
            if (parts.length > 2) e.setPassword(parts[2].trim());
            if (parts.length > 3) e.setRealName(parts[3].trim());
            if (parts.length > 4) e.setPhone(parts[4].trim());
            result.add(e);
        }
        return result;
    }

    private String[] splitCsvLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuote = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuote && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"');
                    i++;
                } else {
                    inQuote = !inQuote;
                }
            } else if (c == ',' && !inQuote) {
                out.add(sb.toString());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        out.add(sb.toString());
        return out.toArray(new String[0]);
    }

    private String currentOperator() {
        try {
            return CurrentUserHolder.requireUserId();
        } catch (IamException ex) {
            return "system";
        }
    }
}