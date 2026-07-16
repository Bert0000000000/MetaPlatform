package com.metaplatform.base.interfaces.rest;

import com.metaplatform.base.audit.Audited;
import com.metaplatform.base.interfaces.rest.dto.CreateTenantRequest;
import com.metaplatform.base.tenant.Tenant;
import com.metaplatform.base.tenant.TenantId;
import com.metaplatform.base.tenant.TenantService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {

    private final TenantService tenantService;

    public TenantController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    @PostMapping
    @Audited(action = "CREATE", resourceType = "tenant", resourceIdSpEL = "#result[id]")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateTenantRequest request) {
        Tenant tenant = tenantService.create(request.name(), request.slug());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(tenant));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> findById(@PathVariable String id) {
        Tenant tenant = tenantService.findById(TenantId.of(id));
        return ResponseEntity.ok(toResponse(tenant));
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> findAll() {
        List<Map<String, Object>> tenants = tenantService.findAll().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(tenants);
    }

    @PutMapping("/{id}/deactivate")
    @Audited(action = "DEACTIVATE", resourceType = "tenant", resourceIdSpEL = "#id")
    public ResponseEntity<Map<String, Object>> deactivate(@PathVariable String id) {
        Tenant tenant = tenantService.deactivate(TenantId.of(id));
        return ResponseEntity.ok(toResponse(tenant));
    }

    @PutMapping("/{id}/activate")
    @Audited(action = "ACTIVATE", resourceType = "tenant", resourceIdSpEL = "#id")
    public ResponseEntity<Map<String, Object>> activate(@PathVariable String id) {
        Tenant tenant = tenantService.activate(TenantId.of(id));
        return ResponseEntity.ok(toResponse(tenant));
    }

    private Map<String, Object> toResponse(Tenant t) {
        return Map.of(
                "id", t.id().toString(),
                "name", t.name(),
                "slug", t.slug(),
                "active", t.isActive(),
                "createdAt", t.createdAt().toString(),
                "updatedAt", t.updatedAt().toString()
        );
    }
}
