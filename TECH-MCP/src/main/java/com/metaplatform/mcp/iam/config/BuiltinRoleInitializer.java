package com.metaplatform.mcp.iam.config;

import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.iam.entity.McpRoleEntity;
import com.metaplatform.mcp.iam.repository.McpRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 启动时初始化内置角色（按 tenant 维度去重）：
 *  - MCP_ADMIN     ：tool:*, resource:*, prompt:*, server:*, client:*, alert:*
 *  - MCP_DEVELOPER :tool:execute, tool:read, resource:read, prompt:read
 *  - MCP_VIEWER    ：tool:read, resource:read, prompt:read
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BuiltinRoleInitializer implements CommandLineRunner {

    private static final String[] BUILTIN_TENANTS = {
            TenantContext.DEFAULT_TENANT_ID
    };

    private static final List<BuiltinRoleSpec> BUILTIN_ROLES = List.of(
            new BuiltinRoleSpec(
                    "MCP_ADMIN",
                    "MCP 管理员",
                    "tool:execute,tool:read,tool:write,tool:delete,resource:read,resource:write,prompt:read,prompt:write,server:read,server:write,client:read,client:write,alert:read,alert:write"
            ),
            new BuiltinRoleSpec(
                    "MCP_DEVELOPER",
                    "MCP 开发者",
                    "tool:execute,tool:read,tool:write,resource:read,prompt:read,server:read,client:read,alert:read"
            ),
            new BuiltinRoleSpec(
                    "MCP_VIEWER",
                    "MCP 只读用户",
                    "[\"tool:read\",\"resource:read\",\"prompt:read\",\"server:read\",\"client:read\",\"alert:read\"]"
            )
    );

    private final McpRoleRepository roleRepository;

    @Override
    public void run(String... args) {
        if (Boolean.getBoolean("mcp.init.builtin-roles.skip")) {
            log.info("BuiltinRoleInitializer skipped by system property");
            return;
        }
        for (String tenantId : BUILTIN_TENANTS) {
            for (BuiltinRoleSpec spec : BUILTIN_ROLES) {
                ensureRole(tenantId, spec);
            }
        }
        log.info("BuiltinRoleInitializer finished, tenants={}, rolesPerTenant={}",
                BUILTIN_TENANTS.length, BUILTIN_ROLES.size());
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void ensureRole(String tenantId, BuiltinRoleSpec spec) {
        try {
            if (roleRepository.findByTenantIdAndCode(tenantId, spec.code).isPresent()) {
                return;
            }
            McpRoleEntity entity = McpRoleEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .code(spec.code)
                    .name(spec.name)
                    .description(spec.description)
                    .builtin(true)
                    .permissions(spec.permissions)
                    .build();
            roleRepository.save(entity);
            log.debug("Created builtin role: tenantId={}, code={}", tenantId, spec.code);
        } catch (Exception e) {
            log.warn("ensureRole failed, tenantId={}, code={}, err={}",
                    tenantId, spec.code, e.getMessage());
        }
    }

    private record BuiltinRoleSpec(String code, String name, String permissions, String description) {
        BuiltinRoleSpec(String code, String name, String permissions) {
            this(code, name, permissions, "Built-in role: " + code);
        }
    }
}