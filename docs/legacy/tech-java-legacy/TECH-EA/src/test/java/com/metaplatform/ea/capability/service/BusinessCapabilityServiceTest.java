package com.metaplatform.ea.capability.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.capability.dto.*;
import com.metaplatform.ea.capability.entity.BusinessCapabilityEntity;
import com.metaplatform.ea.capability.repository.BusinessCapabilityRepository;
import com.metaplatform.ea.common.PageResponse;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
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
class BusinessCapabilityServiceTest {

    @Mock
    private BusinessCapabilityRepository capabilityRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private BusinessCapabilityService capabilityService;

    private UUID capabilityId;
    private UUID parentId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        capabilityId = UUID.randomUUID();
        parentId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldReturnResponse_whenCodeIsAvailable() {
        CreateCapabilityRequest request = new CreateCapabilityRequest();
        request.setName("销售管理");
        request.setCode("SALES_MGMT");
        request.setDescription("销售管理能力");

        when(capabilityRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "SALES_MGMT"))
                .thenReturn(false);
        when(capabilityRepository.save(any(BusinessCapabilityEntity.class))).thenAnswer(i -> i.getArgument(0));

        CapabilityResponse response = capabilityService.create(request);

        assertThat(response.getCode()).isEqualTo("SALES_MGMT");
        assertThat(response.getName()).isEqualTo("销售管理");
        assertThat(response.getLevel()).isEqualTo(0);
        assertThat(response.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void create_shouldThrow_whenCodeAlreadyExists() {
        CreateCapabilityRequest request = new CreateCapabilityRequest();
        request.setName("销售管理");
        request.setCode("SALES_MGMT");

        when(capabilityRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "SALES_MGMT"))
                .thenReturn(true);

        assertThatThrownBy(() -> capabilityService.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("能力 code 在该租户下已存在");
    }

    @Test
    void create_shouldSetLevelFromParent_whenParentIdProvided() {
        CreateCapabilityRequest request = new CreateCapabilityRequest();
        request.setName("客户管理");
        request.setCode("CUSTOMER_MGMT");
        request.setParentId(parentId);

        BusinessCapabilityEntity parent = buildEntity(parentId, "SALES_MGMT", "销售管理", null, 0);

        when(capabilityRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "CUSTOMER_MGMT"))
                .thenReturn(false);
        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(parentId, "tenant-default"))
                .thenReturn(Optional.of(parent));
        ArgumentCaptor<BusinessCapabilityEntity> captor = ArgumentCaptor.forClass(BusinessCapabilityEntity.class);
        when(capabilityRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        CapabilityResponse response = capabilityService.create(request);

        assertThat(response.getLevel()).isEqualTo(1);
        assertThat(captor.getValue().getParentId()).isEqualTo(parentId);
    }

    @Test
    void create_shouldRespectTenantIsolation() {
        TenantContext.set("tenant-acme");
        CreateCapabilityRequest request = new CreateCapabilityRequest();
        request.setName("销售管理");
        request.setCode("SALES_MGMT");

        when(capabilityRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-acme", "SALES_MGMT"))
                .thenReturn(false);
        ArgumentCaptor<BusinessCapabilityEntity> captor = ArgumentCaptor.forClass(BusinessCapabilityEntity.class);
        when(capabilityRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        capabilityService.create(request);

        assertThat(captor.getValue().getTenantId()).isEqualTo("tenant-acme");
    }

    @Test
    void list_shouldReturnPagedResult() {
        BusinessCapabilityEntity entity = buildEntity(capabilityId, "SALES_MGMT", "销售管理", null, 0);
        Page<BusinessCapabilityEntity> page = new PageImpl<>(List.of(entity));
        when(capabilityRepository.search(eq("tenant-default"), eq(null), eq(null), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<CapabilityResponse> response = capabilityService.list(null, null, null, null);

        assertThat(response.getTotal()).isEqualTo(1);
        assertThat(response.getPage()).isEqualTo(1);
        assertThat(response.getItems().get(0).getCode()).isEqualTo("SALES_MGMT");
    }

    @Test
    void get_shouldReturnResponse() {
        BusinessCapabilityEntity entity = buildEntity(capabilityId, "SALES_MGMT", "销售管理", null, 0);
        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(capabilityId, "tenant-default"))
                .thenReturn(Optional.of(entity));

        CapabilityResponse response = capabilityService.get(capabilityId);

        assertThat(response.getId()).isEqualTo(capabilityId);
        assertThat(response.getCode()).isEqualTo("SALES_MGMT");
    }

    @Test
    void get_shouldThrow_whenNotFound() {
        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(capabilityId, "tenant-default"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> capabilityService.get(capabilityId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("业务能力不存在");
    }

    @Test
    void update_shouldUpdateFields() {
        BusinessCapabilityEntity entity = buildEntity(capabilityId, "SALES_MGMT", "销售管理", null, 0);
        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(capabilityId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(capabilityRepository.save(any(BusinessCapabilityEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateCapabilityRequest request = new UpdateCapabilityRequest();
        request.setName("销售管理（更新）");
        request.setSortOrder(5);
        request.setStatus("INACTIVE");

        CapabilityResponse response = capabilityService.update(capabilityId, request);

        assertThat(response.getName()).isEqualTo("销售管理（更新）");
        assertThat(response.getSortOrder()).isEqualTo(5);
        assertThat(response.getStatus()).isEqualTo("INACTIVE");
    }

    @Test
    void delete_shouldSoftDeleteWithCascade() {
        UUID childId = UUID.randomUUID();
        BusinessCapabilityEntity parent = buildEntity(capabilityId, "PARENT", "父能力", null, 0);
        BusinessCapabilityEntity child = buildEntity(childId, "CHILD", "子能力", capabilityId, 1);

        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(capabilityId, "tenant-default"))
                .thenReturn(Optional.of(parent));
        when(capabilityRepository.findByTenantIdAndParentIdAndDeletedAtIsNull("tenant-default", capabilityId))
                .thenReturn(List.of(child));
        when(capabilityRepository.findByTenantIdAndParentIdAndDeletedAtIsNull("tenant-default", childId))
                .thenReturn(List.of());
        when(capabilityRepository.save(any(BusinessCapabilityEntity.class))).thenAnswer(i -> i.getArgument(0));

        capabilityService.delete(capabilityId);

        ArgumentCaptor<BusinessCapabilityEntity> captor = ArgumentCaptor.forClass(BusinessCapabilityEntity.class);
        verify(capabilityRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).allMatch(e -> e.getDeletedAt() != null);
    }

    @Test
    void getTree_shouldBuildHierarchy() {
        BusinessCapabilityEntity root = buildEntity(capabilityId, "ROOT", "根能力", null, 0);
        BusinessCapabilityEntity child = buildEntity(UUID.randomUUID(), "CHILD", "子能力", capabilityId, 1);
        when(capabilityRepository.findByTenantIdAndDeletedAtIsNullOrderBySortOrderAscNameAsc("tenant-default"))
                .thenReturn(List.of(root, child));

        List<CapabilityTreeNode> tree = capabilityService.getTree();

        assertThat(tree).hasSize(1);
        assertThat(tree.get(0).getCode()).isEqualTo("ROOT");
        assertThat(tree.get(0).getChildren()).hasSize(1);
        assertThat(tree.get(0).getChildren().get(0).getCode()).isEqualTo("CHILD");
    }

    @Test
    void getChildren_shouldReturnDirectChildren() {
        BusinessCapabilityEntity child = buildEntity(UUID.randomUUID(), "CHILD", "子能力", capabilityId, 1);
        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(capabilityId, "tenant-default"))
                .thenReturn(Optional.of(buildEntity(capabilityId, "ROOT", "根能力", null, 0)));
        when(capabilityRepository.findByTenantIdAndParentIdAndDeletedAtIsNullOrderBySortOrderAscNameAsc("tenant-default", capabilityId))
                .thenReturn(List.of(child));

        List<CapabilityResponse> children = capabilityService.getChildren(capabilityId);

        assertThat(children).hasSize(1);
        assertThat(children.get(0).getCode()).isEqualTo("CHILD");
    }

    @Test
    void getAncestors_shouldReturnAncestorChain() {
        UUID grandparentId = UUID.randomUUID();
        BusinessCapabilityEntity entity = buildEntity(capabilityId, "CHILD", "子能力", parentId, 2);
        BusinessCapabilityEntity parent = buildEntity(parentId, "PARENT", "父能力", grandparentId, 1);
        BusinessCapabilityEntity grandparent = buildEntity(grandparentId, "GRANDPARENT", "祖父能力", null, 0);

        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(capabilityId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(parentId, "tenant-default"))
                .thenReturn(Optional.of(parent));
        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(grandparentId, "tenant-default"))
                .thenReturn(Optional.of(grandparent));

        List<CapabilityResponse> ancestors = capabilityService.getAncestors(capabilityId);

        assertThat(ancestors).hasSize(2);
        assertThat(ancestors.get(0).getCode()).isEqualTo("PARENT");
        assertThat(ancestors.get(1).getCode()).isEqualTo("GRANDPARENT");
    }

    @Test
    void move_shouldUpdateLevelAndDescendants() {
        BusinessCapabilityEntity entity = buildEntity(capabilityId, "CHILD", "子能力", null, 0);
        BusinessCapabilityEntity newParent = buildEntity(parentId, "PARENT", "父能力", null, 2);
        UUID descendantId = UUID.randomUUID();
        BusinessCapabilityEntity descendant = buildEntity(descendantId, "DESC", "后代", capabilityId, 1);

        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(capabilityId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(parentId, "tenant-default"))
                .thenReturn(Optional.of(newParent));
        when(capabilityRepository.findByTenantIdAndParentIdAndDeletedAtIsNull("tenant-default", capabilityId))
                .thenReturn(List.of(descendant));
        when(capabilityRepository.findByTenantIdAndParentIdAndDeletedAtIsNull("tenant-default", descendantId))
                .thenReturn(List.of());
        when(capabilityRepository.save(any(BusinessCapabilityEntity.class))).thenAnswer(i -> i.getArgument(0));

        MoveCapabilityRequest request = new MoveCapabilityRequest();
        request.setNewParentId(parentId);

        CapabilityResponse response = capabilityService.move(capabilityId, request);

        assertThat(response.getLevel()).isEqualTo(3);
        assertThat(response.getParentId()).isEqualTo(parentId);
        ArgumentCaptor<BusinessCapabilityEntity> captor = ArgumentCaptor.forClass(BusinessCapabilityEntity.class);
        verify(capabilityRepository, atLeastOnce()).save(captor.capture());
        BusinessCapabilityEntity savedDescendant = captor.getAllValues().stream()
                .filter(e -> e.getId().equals(descendantId))
                .findFirst().orElseThrow();
        assertThat(savedDescendant.getLevel()).isEqualTo(4);
    }

    @Test
    void move_shouldThrow_whenCircularReference() {
        BusinessCapabilityEntity entity = buildEntity(capabilityId, "CHILD", "子能力", null, 0);
        UUID descendantId = UUID.randomUUID();
        BusinessCapabilityEntity descendant = buildEntity(descendantId, "DESC", "后代", capabilityId, 1);

        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(capabilityId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(capabilityRepository.findByTenantIdAndParentIdAndDeletedAtIsNull("tenant-default", capabilityId))
                .thenReturn(List.of(descendant));

        MoveCapabilityRequest request = new MoveCapabilityRequest();
        request.setNewParentId(descendantId);

        assertThatThrownBy(() -> capabilityService.move(capabilityId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("循环引用");
    }

    @Test
    void move_toRoot_shouldSetLevelZero() {
        BusinessCapabilityEntity entity = buildEntity(capabilityId, "CHILD", "子能力", parentId, 2);
        UUID childOfChildId = UUID.randomUUID();
        BusinessCapabilityEntity childOfChild = buildEntity(childOfChildId, "GRANDCHILD", "孙能力", capabilityId, 3);

        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(capabilityId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(capabilityRepository.findByTenantIdAndParentIdAndDeletedAtIsNull("tenant-default", capabilityId))
                .thenReturn(List.of(childOfChild));
        when(capabilityRepository.findByTenantIdAndParentIdAndDeletedAtIsNull("tenant-default", childOfChildId))
                .thenReturn(List.of());
        when(capabilityRepository.save(any(BusinessCapabilityEntity.class))).thenAnswer(i -> i.getArgument(0));

        MoveCapabilityRequest request = new MoveCapabilityRequest();
        request.setNewParentId(null);

        CapabilityResponse response = capabilityService.move(capabilityId, request);

        assertThat(response.getLevel()).isEqualTo(0);
        assertThat(response.getParentId()).isNull();
    }

    private BusinessCapabilityEntity buildEntity(UUID id, String code, String name, UUID parentId, int level) {
        return BusinessCapabilityEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name(name)
                .code(code)
                .description("desc")
                .parentId(parentId)
                .level(level)
                .sortOrder(0)
                .status("ACTIVE")
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
