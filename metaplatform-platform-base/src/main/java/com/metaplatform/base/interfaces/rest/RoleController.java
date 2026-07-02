package com.metaplatform.base.interfaces.rest;

import com.metaplatform.base.audit.Audited;
import com.metaplatform.base.interfaces.rest.dto.CreateRoleRequest;
import com.metaplatform.base.rbac.*;
import com.metaplatform.base.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/roles")
public class RoleController {

    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;

    public RoleController(RoleRepository roleRepository, UserRoleRepository userRoleRepository) {
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
    }

    @PostMapping
    @Audited(action = "CREATE", resourceType = "role", resourceIdSpEL = "#result[body][id]")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateRoleRequest request) {
        UUID tenantId = TenantContext.get().value();
        Role role = new Role(tenantId, request.name(), request.description(), false);

        if (request.permissions() != null) {
            for (CreateRoleRequest.PermissionSpec spec : request.permissions()) {
                role.addPermission(Permission.of(spec.resource(), spec.action()));
            }
        }

        Role saved = roleRepository.save(role);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listByTenant() {
        UUID tenantId = TenantContext.get().value();
        List<Map<String, Object>> roles = roleRepository.findByTenantId(tenantId).stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(roles);
    }

    @GetMapping("/{roleId}")
    public ResponseEntity<Map<String, Object>> findById(@PathVariable UUID roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("Role not found: " + roleId));
        return ResponseEntity.ok(toResponse(role));
    }

    @DeleteMapping("/{roleId}")
    @Audited(action = "DELETE", resourceType = "role", resourceIdSpEL = "#roleId")
    public ResponseEntity<Void> delete(@PathVariable UUID roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("Role not found: " + roleId));
        if (role.isSystemRole()) {
            throw new IllegalArgumentException("Cannot delete system role");
        }
        roleRepository.delete(role);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{roleId}/users/{userId}")
    @Audited(action = "ASSIGN_ROLE", resourceType = "user-role", resourceIdSpEL = "#roleId")
    public ResponseEntity<Void> assignRole(@PathVariable UUID roleId, @PathVariable UUID userId) {
        UUID tenantId = TenantContext.get().value();
        UUID assignedBy = UUID.randomUUID(); // TODO: 从 SecurityContext 获取

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("Role not found: " + roleId));

        UserRole userRole = new UserRole(tenantId, userId, role, assignedBy);
        userRoleRepository.save(userRole);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{roleId}/users/{userId}")
    @Audited(action = "REVOKE_ROLE", resourceType = "user-role", resourceIdSpEL = "#roleId")
    public ResponseEntity<Void> revokeRole(@PathVariable UUID roleId, @PathVariable UUID userId) {
        UUID tenantId = TenantContext.get().value();
        userRoleRepository.deleteByTenantIdAndUserIdAndRoleId(tenantId, userId, roleId);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toResponse(Role r) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", r.getId().toString());
        map.put("tenantId", r.getTenantId().toString());
        map.put("name", r.getName());
        map.put("description", r.getDescription());
        map.put("systemRole", r.isSystemRole());
        map.put("permissions", r.getPermissions().stream()
                .map(p -> Map.of("resource", p.resource(), "action", p.action()))
                .toList());
        return map;
    }
}
