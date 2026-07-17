package com.metaplatform.ea.role.service;

import com.metaplatform.ea.capability.entity.BusinessCapabilityEntity;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.role.dto.AssignRoleRequest;
import com.metaplatform.ea.role.dto.CapabilityRoleResponse;
import com.metaplatform.ea.role.entity.BusinessRoleEntity;
import com.metaplatform.ea.role.entity.CapabilityRoleEntity;
import com.metaplatform.ea.role.repository.CapabilityRoleRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CapabilityRoleServiceTest {

    @Mock
    private CapabilityRoleRepository capabilityRoleRepository;

    @Mock
    private BusinessRoleService businessRoleService;

    @Mock
    private BusinessCapabilityService capabilityService;

    @InjectMocks
    private CapabilityRoleService capabilityRoleService;

    private UUID capabilityId;
    private UUID roleId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        capabilityId = UUID.randomUUID();
        roleId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void assignRole_shouldReturnResponse() {
        AssignRoleRequest request = new AssignRoleRequest();
        request.setRoleId(roleId);
        request.setRelationship("OWNER");

        BusinessRoleEntity role = buildRole(roleId, "SALES_MANAGER", "销售经理");

        when(capabilityRoleRepository.existsByTenantIdAndCapabilityIdAndRoleId("tenant-default", capabilityId, roleId))
                .thenReturn(false);
        when(businessRoleService.findById(roleId)).thenReturn(role);
        when(capabilityRoleRepository.save(any(CapabilityRoleEntity.class))).thenAnswer(i -> i.getArgument(0));

        CapabilityRoleResponse response = capabilityRoleService.assignRole(capabilityId, request);

        assertThat(response.getCapabilityId()).isEqualTo(capabilityId);
        assertThat(response.getRoleId()).isEqualTo(roleId);
        assertThat(response.getRelationship()).isEqualTo("OWNER");
        assertThat(response.getRoleName()).isEqualTo("销售经理");
    }

    @Test
    void assignRole_shouldThrow_whenAlreadyAssigned() {
        AssignRoleRequest request = new AssignRoleRequest();
        request.setRoleId(roleId);
        request.setRelationship("OWNER");

        when(capabilityRoleRepository.existsByTenantIdAndCapabilityIdAndRoleId("tenant-default", capabilityId, roleId))
                .thenReturn(true);

        assertThatThrownBy(() -> capabilityRoleService.assignRole(capabilityId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("该角色已分配到此能力");
    }

    @Test
    void assignRole_shouldThrow_whenInvalidRelationship() {
        AssignRoleRequest request = new AssignRoleRequest();
        request.setRoleId(roleId);
        request.setRelationship("INVALID");

        when(capabilityRoleRepository.existsByTenantIdAndCapabilityIdAndRoleId("tenant-default", capabilityId, roleId))
                .thenReturn(false);
        when(businessRoleService.findById(roleId)).thenReturn(buildRole(roleId, "SALES_MANAGER", "销售经理"));

        assertThatThrownBy(() -> capabilityRoleService.assignRole(capabilityId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("relationship 必须为 OWNER、PARTICIPANT 或 SUPPORT");
    }

    @Test
    void getRolesForCapability_shouldReturnRoles() {
        UUID assignmentId = UUID.randomUUID();
        CapabilityRoleEntity assignment = CapabilityRoleEntity.builder()
                .id(assignmentId)
                .tenantId("tenant-default")
                .capabilityId(capabilityId)
                .roleId(roleId)
                .relationship("OWNER")
                .createdAt(Instant.now())
                .build();
        BusinessRoleEntity role = buildRole(roleId, "SALES_MANAGER", "销售经理");

        when(capabilityRoleRepository.findByTenantIdAndCapabilityId("tenant-default", capabilityId))
                .thenReturn(List.of(assignment));
        when(businessRoleService.findById(roleId)).thenReturn(role);

        List<CapabilityRoleResponse> roles = capabilityRoleService.getRolesForCapability(capabilityId);

        assertThat(roles).hasSize(1);
        assertThat(roles.get(0).getRoleCode()).isEqualTo("SALES_MANAGER");
        assertThat(roles.get(0).getRelationship()).isEqualTo("OWNER");
    }

    @Test
    void unassignRole_shouldDeleteAssignment() {
        when(capabilityRoleRepository.existsByTenantIdAndCapabilityIdAndRoleId("tenant-default", capabilityId, roleId))
                .thenReturn(true);

        capabilityRoleService.unassignRole(capabilityId, roleId);

        verify(capabilityRoleRepository).deleteByTenantIdAndCapabilityIdAndRoleId("tenant-default", capabilityId, roleId);
    }

    @Test
    void unassignRole_shouldThrow_whenNotAssigned() {
        when(capabilityRoleRepository.existsByTenantIdAndCapabilityIdAndRoleId("tenant-default", capabilityId, roleId))
                .thenReturn(false);

        assertThatThrownBy(() -> capabilityRoleService.unassignRole(capabilityId, roleId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("角色未分配到此能力");
    }

    @Test
    void getCapabilitiesForRole_shouldReturnAssignments() {
        UUID assignmentId = UUID.randomUUID();
        CapabilityRoleEntity assignment = CapabilityRoleEntity.builder()
                .id(assignmentId)
                .tenantId("tenant-default")
                .capabilityId(capabilityId)
                .roleId(roleId)
                .relationship("PARTICIPANT")
                .createdAt(Instant.now())
                .build();
        BusinessRoleEntity role = buildRole(roleId, "SALES_MANAGER", "销售经理");

        when(capabilityRoleRepository.findByTenantIdAndRoleId("tenant-default", roleId))
                .thenReturn(List.of(assignment));
        when(businessRoleService.findById(roleId)).thenReturn(role);

        List<CapabilityRoleResponse> result = capabilityRoleService.getCapabilitiesForRole(roleId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCapabilityId()).isEqualTo(capabilityId);
        assertThat(result.get(0).getRelationship()).isEqualTo("PARTICIPANT");
    }

    private BusinessRoleEntity buildRole(UUID id, String code, String name) {
        return BusinessRoleEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name(name)
                .code(code)
                .description("desc")
                .responsibility("resp")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
