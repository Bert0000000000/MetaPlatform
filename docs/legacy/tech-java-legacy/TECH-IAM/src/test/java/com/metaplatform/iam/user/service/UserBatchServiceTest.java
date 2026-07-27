package com.metaplatform.iam.user.service;

import com.metaplatform.iam.dto.user.BatchAssignPositionRequest;
import com.metaplatform.iam.dto.user.BatchAssignResponse;
import com.metaplatform.iam.dto.user.BatchAssignRoleRequest;
import com.metaplatform.iam.dto.user.BatchImportUsersRequest;
import com.metaplatform.iam.dto.user.BatchImportUsersResponse;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.position.repository.UserPositionRepository;
import com.metaplatform.iam.repository.DepartmentRepository;
import com.metaplatform.iam.repository.RoleRepository;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.repository.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserBatchServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private UserRoleRepository userRoleRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private UserPositionRepository userPositionRepository;
    @Mock private PasswordEncoder passwordEncoder;

    private UserBatchService service;

    @BeforeEach
    void setUp() {
        service = new UserBatchService(userRepository, roleRepository, userRoleRepository,
                departmentRepository, userPositionRepository, passwordEncoder);
    }

    private UserEntity sampleUser() {
        return UserEntity.builder()
                .id("user-1")
                .tenantId("tenant-default")
                .username("alice")
                .email("alice@example.com")
                .status(UserEntity.UserStatus.ENABLED)
                .build();
    }

    @Test
    void batch_import_with_users_success() {
        BatchImportUsersRequest request = new BatchImportUsersRequest();
        BatchImportUsersRequest.RegisterEntry entry = new BatchImportUsersRequest.RegisterEntry();
        entry.setUsername("alice");
        entry.setEmail("alice@example.com");
        entry.setPassword("Password1!");
        entry.setRealName("Alice");
        request.setUsers(List.of(entry));

        when(userRepository.existsByTenantIdAndUsername(anyString(), anyString())).thenReturn(false);
        when(userRepository.existsByTenantIdAndEmail(anyString(), anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> {
            UserEntity u = inv.getArgument(0);
            u.setId("user-1");
            return u;
        });

        BatchImportUsersResponse response = service.batchImport(request);
        assertThat(response.getSuccessCount()).isEqualTo(1);
        assertThat(response.getFailedCount()).isEqualTo(0);
        assertThat(response.getResults().get(0).isSuccess()).isTrue();
    }

    @Test
    void batch_import_with_csv_parses_lines() {
        BatchImportUsersRequest request = new BatchImportUsersRequest();
        request.setCsvData("username,email,password,realName\nalice,a@a.com,Password1!,Alice\nbob,b@b.com,Password1!,Bob");

        when(userRepository.existsByTenantIdAndUsername(anyString(), anyString())).thenReturn(false);
        when(userRepository.existsByTenantIdAndEmail(anyString(), anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> {
            UserEntity u = inv.getArgument(0);
            u.setId(u.getUsername());
            return u;
        });

        BatchImportUsersResponse response = service.batchImport(request);
        assertThat(response.getTotalCount()).isEqualTo(2);
        assertThat(response.getSuccessCount()).isEqualTo(2);
    }

    @Test
    void batch_import_duplicate_username_marks_failure() {
        BatchImportUsersRequest request = new BatchImportUsersRequest();
        BatchImportUsersRequest.RegisterEntry entry = new BatchImportUsersRequest.RegisterEntry();
        entry.setUsername("alice");
        entry.setEmail("alice@example.com");
        entry.setPassword("Password1!");
        request.setUsers(List.of(entry));

        when(userRepository.existsByTenantIdAndUsername(anyString(), anyString())).thenReturn(true);

        BatchImportUsersResponse response = service.batchImport(request);
        assertThat(response.getFailedCount()).isEqualTo(1);
        assertThat(response.getResults().get(0).isSuccess()).isFalse();
    }

    @Test
    void batch_assign_role_success() {
        BatchAssignRoleRequest request = new BatchAssignRoleRequest();
        request.setUserIds(List.of("user-1", "user-2"));
        request.setRoleId("role-1");

        when(roleRepository.existsById("role-1")).thenReturn(true);
        when(userRepository.findById("user-1")).thenReturn(Optional.of(sampleUser()));
        when(userRepository.findById("user-2")).thenReturn(Optional.of(sampleUser()));
        when(userRoleRepository.existsByUserIdAndRoleIdAndDeletedFalse(anyString(), anyString())).thenReturn(false);
        when(userRoleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BatchAssignResponse response = service.batchAssignRole(request);
        assertThat(response.getSuccessCount()).isEqualTo(2);
    }

    @Test
    void batch_assign_position_success() {
        BatchAssignPositionRequest request = new BatchAssignPositionRequest();
        request.setUserIds(List.of("user-1"));
        request.setPositionId("pos-1");
        request.setDepartmentId("dept-1");
        request.setIsPrimary(true);

        when(departmentRepository.existsById("dept-1")).thenReturn(true);
        when(userRepository.findById("user-1")).thenReturn(Optional.of(sampleUser()));
        when(userPositionRepository.findByUserIdAndPositionIdAndDepartmentIdAndDeletedFalse(
                anyString(), anyString(), anyString())).thenReturn(Optional.empty());
        when(userPositionRepository.countByUserIdAndIsPrimaryTrueAndDeletedFalse(anyString())).thenReturn(0L);
        when(userPositionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BatchAssignResponse response = service.batchAssignPosition(request);
        assertThat(response.getSuccessCount()).isEqualTo(1);
    }
}