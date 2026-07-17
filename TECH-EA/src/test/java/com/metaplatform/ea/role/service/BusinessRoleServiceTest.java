package com.metaplatform.ea.role.service;

import com.metaplatform.ea.common.PageResponse;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.role.dto.CreateRoleRequest;
import com.metaplatform.ea.role.dto.RoleResponse;
import com.metaplatform.ea.role.dto.UpdateRoleRequest;
import com.metaplatform.ea.role.entity.BusinessRoleEntity;
import com.metaplatform.ea.role.repository.BusinessRoleRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BusinessRoleServiceTest {

    @Mock
    private BusinessRoleRepository roleRepository;

    @InjectMocks
    private BusinessRoleService roleService;

    private UUID roleId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        roleId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldReturnResponse_whenCodeIsAvailable() {
        CreateRoleRequest request = new CreateRoleRequest();
        request.setName("销售经理");
        request.setCode("SALES_MANAGER");
        request.setDescription("负责销售管理");
        request.setResponsibility("制定销售策略");

        when(roleRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "SALES_MANAGER"))
                .thenReturn(false);
        when(roleRepository.save(any(BusinessRoleEntity.class))).thenAnswer(i -> i.getArgument(0));

        RoleResponse response = roleService.create(request);

        assertThat(response.getCode()).isEqualTo("SALES_MANAGER");
        assertThat(response.getName()).isEqualTo("销售经理");
        assertThat(response.getResponsibility()).isEqualTo("制定销售策略");
    }

    @Test
    void create_shouldThrow_whenCodeAlreadyExists() {
        CreateRoleRequest request = new CreateRoleRequest();
        request.setName("销售经理");
        request.setCode("SALES_MANAGER");

        when(roleRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "SALES_MANAGER"))
                .thenReturn(true);

        assertThatThrownBy(() -> roleService.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("角色 code 在该租户下已存在");
    }

    @Test
    void create_shouldRespectTenantIsolation() {
        TenantContext.set("tenant-acme");
        CreateRoleRequest request = new CreateRoleRequest();
        request.setName("销售经理");
        request.setCode("SALES_MANAGER");

        when(roleRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-acme", "SALES_MANAGER"))
                .thenReturn(false);
        ArgumentCaptor<BusinessRoleEntity> captor = ArgumentCaptor.forClass(BusinessRoleEntity.class);
        when(roleRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        roleService.create(request);

        assertThat(captor.getValue().getTenantId()).isEqualTo("tenant-acme");
    }

    @Test
    void list_shouldReturnPagedResult() {
        BusinessRoleEntity entity = buildEntity(roleId, "SALES_MANAGER", "销售经理");
        Page<BusinessRoleEntity> page = new PageImpl<>(List.of(entity));
        when(roleRepository.search(eq("tenant-default"), eq(null), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<RoleResponse> response = roleService.list(null, null, null);

        assertThat(response.getTotal()).isEqualTo(1);
        assertThat(response.getItems().get(0).getCode()).isEqualTo("SALES_MANAGER");
    }

    @Test
    void get_shouldReturnResponse() {
        BusinessRoleEntity entity = buildEntity(roleId, "SALES_MANAGER", "销售经理");
        when(roleRepository.findByIdAndTenantIdAndDeletedAtIsNull(roleId, "tenant-default"))
                .thenReturn(Optional.of(entity));

        RoleResponse response = roleService.get(roleId);

        assertThat(response.getId()).isEqualTo(roleId);
        assertThat(response.getCode()).isEqualTo("SALES_MANAGER");
    }

    @Test
    void get_shouldThrow_whenNotFound() {
        when(roleRepository.findByIdAndTenantIdAndDeletedAtIsNull(roleId, "tenant-default"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> roleService.get(roleId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("业务角色不存在");
    }

    @Test
    void update_shouldUpdateFields() {
        BusinessRoleEntity entity = buildEntity(roleId, "SALES_MANAGER", "销售经理");
        when(roleRepository.findByIdAndTenantIdAndDeletedAtIsNull(roleId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(roleRepository.save(any(BusinessRoleEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateRoleRequest request = new UpdateRoleRequest();
        request.setName("高级销售经理");
        request.setResponsibility("管理销售团队");

        RoleResponse response = roleService.update(roleId, request);

        assertThat(response.getName()).isEqualTo("高级销售经理");
        assertThat(response.getResponsibility()).isEqualTo("管理销售团队");
    }

    @Test
    void delete_shouldSoftDelete() {
        BusinessRoleEntity entity = buildEntity(roleId, "SALES_MANAGER", "销售经理");
        when(roleRepository.findByIdAndTenantIdAndDeletedAtIsNull(roleId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        ArgumentCaptor<BusinessRoleEntity> captor = ArgumentCaptor.forClass(BusinessRoleEntity.class);
        when(roleRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        roleService.delete(roleId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private BusinessRoleEntity buildEntity(UUID id, String code, String name) {
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
