package com.metaplatform.iam.service;

import com.metaplatform.iam.dto.department.CreateDepartmentRequest;
import com.metaplatform.iam.dto.department.DepartmentResponse;
import com.metaplatform.iam.dto.department.UpdateDepartmentRequest;
import com.metaplatform.iam.entity.DepartmentEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.DepartmentRepository;
import com.metaplatform.iam.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DepartmentServiceTest {

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private DepartmentService departmentService;

    @Test
    void create_shouldReturnDepartmentResponse_whenCodeIsAvailable() {
        CreateDepartmentRequest request = new CreateDepartmentRequest();
        request.setDeptCode("RD");
        request.setDeptName("研发部");

        when(departmentRepository.existsByTenantIdAndDeptCodeAndDeletedFalse("tenant-default", "RD")).thenReturn(false);
        when(departmentRepository.save(any(DepartmentEntity.class))).thenAnswer(invocation -> {
            DepartmentEntity entity = invocation.getArgument(0);
            return entity;
        });

        DepartmentResponse response = departmentService.create(request);

        assertThat(response.getDeptCode()).isEqualTo("RD");
        assertThat(response.getDeptName()).isEqualTo("研发部");
        assertThat(response.getLevel()).isEqualTo(1);
        assertThat(response.getFullPath()).isEqualTo("/研发部");
    }

    @Test
    void create_shouldThrow_whenCodeAlreadyExists() {
        CreateDepartmentRequest request = new CreateDepartmentRequest();
        request.setDeptCode("RD");
        request.setDeptName("研发部");

        when(departmentRepository.existsByTenantIdAndDeptCodeAndDeletedFalse("tenant-default", "RD")).thenReturn(true);

        assertThatThrownBy(() -> departmentService.create(request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("部门编码在该租户下已存在");
    }

    @Test
    void create_shouldComputeLevel_whenParentProvided() {
        CreateDepartmentRequest request = new CreateDepartmentRequest();
        request.setDeptCode("RD-BE");
        request.setDeptName("后端组");
        request.setParentId("parent-id");

        DepartmentEntity parent = DepartmentEntity.builder()
                .id("parent-id")
                .deptName("研发部")
                .level(2)
                .parentPath("")
                .fullPath("/总部/研发部")
                .build();

        when(departmentRepository.existsByTenantIdAndDeptCodeAndDeletedFalse("tenant-default", "RD-BE")).thenReturn(false);
        when(departmentRepository.findByIdAndDeletedFalse("parent-id")).thenReturn(Optional.of(parent));
        when(departmentRepository.save(any(DepartmentEntity.class))).thenAnswer(i -> i.getArgument(0));

        DepartmentResponse response = departmentService.create(request);

        assertThat(response.getLevel()).isEqualTo(3);
        assertThat(response.getFullPath()).isEqualTo("/总部/研发部/后端组");
    }

    @Test
    void softDelete_shouldThrow_whenDepartmentHasChildren() {
        DepartmentEntity entity = DepartmentEntity.builder()
                .id("d1").deptCode("A").deptName("A").level(1)
                .parentId(null).fullPath("/A").tenantId("tenant-default")
                .deleted(false).version(1).build();

        when(departmentRepository.findByIdAndDeletedFalse("d1")).thenReturn(Optional.of(entity));
        when(departmentRepository.countByParentIdAndDeletedFalse("d1")).thenReturn(2L);

        assertThatThrownBy(() -> departmentService.softDelete("d1"))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("存在子部门");
    }

    @Test
    void softDelete_shouldThrow_whenDeletingRootDepartment() {
        DepartmentEntity entity = DepartmentEntity.builder()
                .id("d1").deptCode("HQ").deptName("总部").level(1)
                .parentId(null).fullPath("/总部").tenantId("tenant-default")
                .deleted(false).version(1).build();

        when(departmentRepository.findByIdAndDeletedFalse("d1")).thenReturn(Optional.of(entity));
        when(departmentRepository.countByParentIdAndDeletedFalse("d1")).thenReturn(0L);

        assertThatThrownBy(() -> departmentService.softDelete("d1"))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("不可删除根部门");
    }

    @Test
    void update_shouldThrowVersionConflict_whenVersionMismatch() {
        DepartmentEntity entity = DepartmentEntity.builder()
                .id("d1").deptCode("A").deptName("A").level(1)
                .parentId("p").fullPath("/p/A").tenantId("tenant-default")
                .deleted(false).version(2).build();

        when(departmentRepository.findByIdAndDeletedFalse("d1")).thenReturn(Optional.of(entity));

        UpdateDepartmentRequest request = new UpdateDepartmentRequest();
        request.setVersion(1);

        assertThatThrownBy(() -> departmentService.update("d1", request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("部门版本不匹配");
    }
}