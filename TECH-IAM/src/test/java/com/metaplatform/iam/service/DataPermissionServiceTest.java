package com.metaplatform.iam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.dto.datapermission.CreateDataPermissionRequest;
import com.metaplatform.iam.dto.datapermission.DataScopeResolveResponse;
import com.metaplatform.iam.entity.DataPermissionEntity;
import com.metaplatform.iam.entity.DepartmentEntity;
import com.metaplatform.iam.entity.UserDepartmentEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.DataPermissionRepository;
import com.metaplatform.iam.repository.DepartmentRepository;
import com.metaplatform.iam.repository.UserDepartmentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataPermissionServiceTest {

    @Mock
    private DataPermissionRepository dataPermissionRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private UserDepartmentRepository userDepartmentRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private DataPermissionService dataPermissionService;

    @Test
    void create_shouldReturnResponse_whenRuleIsNew() {
        CreateDataPermissionRequest request = new CreateDataPermissionRequest();
        request.setRoleId("role-001");
        request.setResourceType("concept");
        request.setResourceId("PERSON");
        request.setDataScope(DataPermissionEntity.DataScope.DEPT);
        request.setColumnFilter(List.of("salary", "id_card"));

        when(dataPermissionRepository.existsByTenantIdAndRoleIdAndResourceTypeAndResourceIdAndDeletedFalse(
                "tenant-default", "role-001", "concept", "PERSON")).thenReturn(false);
        when(dataPermissionRepository.save(any(DataPermissionEntity.class))).thenAnswer(i -> i.getArgument(0));

        var response = dataPermissionService.create(request);

        assertThat(response.getRoleId()).isEqualTo("role-001");
        assertThat(response.getResourceType()).isEqualTo("concept");
        assertThat(response.getResourceId()).isEqualTo("PERSON");
        assertThat(response.getDataScope()).isEqualTo(DataPermissionEntity.DataScope.DEPT);
        assertThat(response.getColumnFilter()).containsExactly("salary", "id_card");
        assertThat(response.getEffect()).isEqualTo(DataPermissionEntity.Effect.ALLOW);
    }

    @Test
    void resolveDataScope_shouldReturnAll_whenAnyRoleHasAllScope() {
        DataPermissionEntity allScopeRule = DataPermissionEntity.builder()
                .id("dp-1").tenantId("tenant-default").roleId("role-001")
                .resourceType("concept").dataScope(DataPermissionEntity.DataScope.ALL)
                .effect(DataPermissionEntity.Effect.ALLOW).build();
        DataPermissionEntity deptScopeRule = DataPermissionEntity.builder()
                .id("dp-2").tenantId("tenant-default").roleId("role-002")
                .resourceType("concept").dataScope(DataPermissionEntity.DataScope.DEPT)
                .effect(DataPermissionEntity.Effect.ALLOW).build();

        when(dataPermissionRepository.findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(
                "tenant-default", "role-001", "concept")).thenReturn(List.of(allScopeRule));
        when(dataPermissionRepository.findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(
                "tenant-default", "role-002", "concept")).thenReturn(List.of(deptScopeRule));

        DataPermissionEntity.DataScope scope = dataPermissionService
                .resolveDataScope(List.of("role-001", "role-002"), "concept");

        assertThat(scope).isEqualTo(DataPermissionEntity.DataScope.ALL);
    }

    @Test
    void resolveDataScope_shouldReturnDept_andApplyRowFilterWithUserDepts() {
        DataPermissionEntity deptRule = DataPermissionEntity.builder()
                .id("dp-1").tenantId("tenant-default").roleId("role-001")
                .resourceType("concept").dataScope(DataPermissionEntity.DataScope.DEPT)
                .effect(DataPermissionEntity.Effect.ALLOW).build();

        when(dataPermissionRepository.findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(
                "tenant-default", "role-001", "concept")).thenReturn(List.of(deptRule));

        UserDepartmentEntity ud = UserDepartmentEntity.builder()
                .id("ud-1").userId("user-001").departmentId("dept-A").build();
        when(userDepartmentRepository.findByUserIdAndDeletedFalse("user-001")).thenReturn(List.of(ud));

        DataPermissionEntity.DataScope scope = dataPermissionService
                .resolveDataScope(List.of("role-001"), "concept");
        assertThat(scope).isEqualTo(DataPermissionEntity.DataScope.DEPT);

        String rowFilter = dataPermissionService.applyRowFilter(scope, "user-001");
        assertThat(rowFilter).contains("dept_id IN");
        assertThat(rowFilter).contains("dept-A");
    }

    @Test
    void resolveDataScope_shouldReturnSelf_whenNoRulesMatch() {
        when(dataPermissionRepository.findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(
                "tenant-default", "role-001", "concept")).thenReturn(List.of());

        DataPermissionEntity.DataScope scope = dataPermissionService
                .resolveDataScope(List.of("role-001"), "concept");

        assertThat(scope).isEqualTo(DataPermissionEntity.DataScope.SELF);

        String rowFilter = dataPermissionService.applyRowFilter(scope, "user-001");
        assertThat(rowFilter).isEqualTo("created_by = 'user-001'");
    }

    @Test
    void resolveColumnFilter_shouldMergeFromMultipleRoles() {
        DataPermissionEntity rule1 = DataPermissionEntity.builder()
                .id("dp-1").tenantId("tenant-default").roleId("role-001")
                .resourceType("concept").dataScope(DataPermissionEntity.DataScope.ALL)
                .columnFilter("[\"salary\"]")
                .effect(DataPermissionEntity.Effect.ALLOW).build();
        DataPermissionEntity rule2 = DataPermissionEntity.builder()
                .id("dp-2").tenantId("tenant-default").roleId("role-002")
                .resourceType("concept").dataScope(DataPermissionEntity.DataScope.ALL)
                .columnFilter("[\"id_card\",\"phone\"]")
                .effect(DataPermissionEntity.Effect.ALLOW).build();

        when(dataPermissionRepository.findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(
                "tenant-default", "role-001", "concept")).thenReturn(List.of(rule1));
        when(dataPermissionRepository.findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(
                "tenant-default", "role-002", "concept")).thenReturn(List.of(rule2));

        List<String> columns = dataPermissionService
                .resolveColumnFilter(List.of("role-001", "role-002"), "concept");

        assertThat(columns).containsExactlyInAnyOrder("salary", "id_card", "phone");
    }

    @Test
    void resolve_shouldReturnCompleteResponse_withDeptAndSubScope() {
        DataPermissionEntity rule = DataPermissionEntity.builder()
                .id("dp-1").tenantId("tenant-default").roleId("role-001")
                .resourceType("concept").dataScope(DataPermissionEntity.DataScope.DEPT_AND_SUB)
                .columnFilter("[\"salary\"]")
                .effect(DataPermissionEntity.Effect.ALLOW).build();

        when(dataPermissionRepository.findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(
                "tenant-default", "role-001", "concept")).thenReturn(List.of(rule));

        UserDepartmentEntity ud = UserDepartmentEntity.builder()
                .id("ud-1").userId("user-001").departmentId("dept-A").build();
        when(userDepartmentRepository.findByUserIdAndDeletedFalse("user-001")).thenReturn(List.of(ud));

        DepartmentEntity subDept = DepartmentEntity.builder()
                .id("dept-B").parentId("dept-A").build();
        when(departmentRepository.findByTenantIdAndParentIdAndDeletedFalse(
                "tenant-default", "dept-A")).thenReturn(List.of(subDept));
        when(departmentRepository.findByTenantIdAndParentIdAndDeletedFalse(
                "tenant-default", "dept-B")).thenReturn(List.of());

        DataScopeResolveResponse response = dataPermissionService
                .resolve("user-001", List.of("role-001"), "concept");

        assertThat(response.getDataScope()).isEqualTo(DataPermissionEntity.DataScope.DEPT_AND_SUB);
        assertThat(response.getRowFilter()).contains("dept-A");
        assertThat(response.getRowFilter()).contains("dept-B");
        assertThat(response.getColumnFilter()).containsExactly("salary");
    }

    @Test
    void delete_shouldThrow_whenNotFound() {
        when(dataPermissionRepository.findByIdAndDeletedFalse("non-existent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dataPermissionService.delete("non-existent"))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("数据权限规则不存在");
    }
}
