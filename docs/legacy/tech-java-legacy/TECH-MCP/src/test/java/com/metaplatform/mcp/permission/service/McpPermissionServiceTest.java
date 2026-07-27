package com.metaplatform.mcp.permission.service;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.permission.dto.*;
import com.metaplatform.mcp.permission.entity.McpPermissionRuleEntity;
import com.metaplatform.mcp.permission.repository.McpPermissionRuleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * 权限服务核心测试：重点覆盖 evaluate 评估算法（通过 check/matrix 间接验证）。
 * 注意：record 访问器无 get 前缀（如 resp.allowed() 而非 resp.isAllowed()）。
 */
@ExtendWith(MockitoExtension.class)
class McpPermissionServiceTest {

    @Mock
    private McpPermissionRuleRepository repository;

    @InjectMocks
    private McpPermissionService service;

    private McpPermissionRuleEntity rule(String ruleId, String effect, int priority, String actions, String resourceId) {
        return McpPermissionRuleEntity.builder()
                .id(1L)
                .tenantId("tenant-default")
                .ruleId(ruleId)
                .name("rule-" + ruleId)
                .subjectType("USER")
                .subjectId("user-1")
                .resourceType("TOOL")
                .resourceId(resourceId)
                .actions(actions)
                .effect(effect)
                .priority(priority)
                .enabled(true)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
    }

    // ==================== CRUD ====================

    @Test
    void create_saves_entity_with_uuid_ruleId() {
        CreatePermissionRuleRequest req = new CreatePermissionRuleRequest(
                "allow-user1-execute", "USER", "user-1", "TOOL", "tool-1",
                "execute,read", "ALLOW", 10, true);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PermissionRuleResponse resp = service.create(req);

        assertThat(resp.ruleId()).isNotBlank();
        assertThat(resp.effect()).isEqualTo("ALLOW");
        assertThat(resp.actions()).isEqualTo("execute,read");
        assertThat(resp.subjectType()).isEqualTo("USER");
        verify(repository).save(any(McpPermissionRuleEntity.class));
    }

    @Test
    void get_rule_not_found_throws() {
        when(repository.findByTenantIdAndRuleId(any(), eq("missing"))).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get("missing"))
                .isInstanceOf(McpException.class)
                .satisfies(e -> assertThat(((McpException) e).getErrorCode())
                        .isEqualTo(ErrorCode.PERMISSION_RULE_NOT_FOUND));
    }

    @Test
    void update_changes_priority() {
        McpPermissionRuleEntity entity = rule("r-1", "ALLOW", 0, "execute", "tool-1");
        when(repository.findByTenantIdAndRuleId(any(), eq("r-1"))).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PermissionRuleResponse resp = service.update("r-1",
                new UpdatePermissionRuleRequest(null, null, null, null, null, null, null, 99, null));

        assertThat(resp.priority()).isEqualTo(99);
    }

    @Test
    void delete_removes_rule() {
        when(repository.deleteByTenantIdAndRuleId(any(), eq("r-1"))).thenReturn(1L);
        service.delete("r-1");
        verify(repository).deleteByTenantIdAndRuleId(any(), eq("r-1"));
    }

    @Test
    void delete_missing_throws() {
        when(repository.deleteByTenantIdAndRuleId(any(), eq("r-x"))).thenReturn(0L);
        assertThatThrownBy(() -> service.delete("r-x")).isInstanceOf(McpException.class);
    }

    @Test
    void list_returns_paged_results() {
        when(repository.search(any(), any(), any(), any())).thenReturn(
                new PageImpl<>(List.of(rule("r-1", "ALLOW", 0, "execute", "tool-1")),
                        PageRequest.of(0, 20), 1));
        var resp = service.list(null, null, 1, 20);
        assertThat(resp.getTotal()).isEqualTo(1);
        assertThat(resp.getItems()).hasSize(1);
    }

    // ==================== 权限检查（核心） ====================

    @Test
    void check_no_matching_rule_defaults_deny() {
        when(repository.findCandidatesForCheck(any(), any(), any(), any())).thenReturn(List.of());
        PermissionCheckResponse resp = service.check(new PermissionCheckRequest("user-1", "TOOL", "tool-1", "execute"));
        assertThat(resp.allowed()).isFalse();
        assertThat(resp.decision()).isEqualTo("DENY");
        assertThat(resp.reason()).contains("无匹配规则");
    }

    @Test
    void check_allow_rule_grants_access() {
        when(repository.findCandidatesForCheck(any(), any(), any(), any()))
                .thenReturn(List.of(rule("r-allow", "ALLOW", 0, "execute", "tool-1")));
        PermissionCheckResponse resp = service.check(new PermissionCheckRequest("user-1", "TOOL", "tool-1", "execute"));
        assertThat(resp.allowed()).isTrue();
        assertThat(resp.effect()).isEqualTo("ALLOW");
        assertThat(resp.matchedRules()).hasSize(1);
    }

    @Test
    void check_deny_rule_blocks_access() {
        when(repository.findCandidatesForCheck(any(), any(), any(), any()))
                .thenReturn(List.of(rule("r-deny", "DENY", 0, "execute", "tool-1")));
        PermissionCheckResponse resp = service.check(new PermissionCheckRequest("user-1", "TOOL", "tool-1", "execute"));
        assertThat(resp.allowed()).isFalse();
        assertThat(resp.effect()).isEqualTo("DENY");
    }

    @Test
    void check_same_priority_deny_wins_over_allow() {
        McpPermissionRuleEntity allow = rule("r-allow", "ALLOW", 5, "execute", "tool-1");
        McpPermissionRuleEntity deny = rule("r-deny", "DENY", 5, "execute", "tool-1");
        when(repository.findCandidatesForCheck(any(), any(), any(), any())).thenReturn(List.of(allow, deny));

        PermissionCheckResponse resp = service.check(new PermissionCheckRequest("user-1", "TOOL", "tool-1", "execute"));

        assertThat(resp.allowed()).isFalse();
        assertThat(resp.effect()).isEqualTo("DENY");
        assertThat(resp.matchedRules()).hasSize(2);
    }

    @Test
    void check_higher_priority_allow_wins_over_lower_priority_deny() {
        McpPermissionRuleEntity highAllow = rule("r-allow-high", "ALLOW", 10, "execute", "tool-1");
        McpPermissionRuleEntity lowDeny = rule("r-deny-low", "DENY", 1, "execute", "tool-1");
        when(repository.findCandidatesForCheck(any(), any(), any(), any())).thenReturn(List.of(highAllow, lowDeny));

        PermissionCheckResponse resp = service.check(new PermissionCheckRequest("user-1", "TOOL", "tool-1", "execute"));

        assertThat(resp.allowed()).isTrue();
        assertThat(resp.effect()).isEqualTo("ALLOW");
        // 只返回最高优先级组的规则
        assertThat(resp.matchedRules()).hasSize(1);
        assertThat(resp.matchedRules().get(0).ruleId()).isEqualTo("r-allow-high");
    }

    @Test
    void check_higher_priority_deny_wins_over_lower_priority_allow() {
        McpPermissionRuleEntity highDeny = rule("r-deny-high", "DENY", 100, "execute", "tool-1");
        McpPermissionRuleEntity lowAllow = rule("r-allow-low", "ALLOW", 1, "execute", "tool-1");
        when(repository.findCandidatesForCheck(any(), any(), any(), any())).thenReturn(List.of(highDeny, lowAllow));

        PermissionCheckResponse resp = service.check(new PermissionCheckRequest("user-1", "TOOL", "tool-1", "execute"));

        assertThat(resp.allowed()).isFalse();
        assertThat(resp.effect()).isEqualTo("DENY");
        assertThat(resp.matchedRules()).hasSize(1);
        assertThat(resp.matchedRules().get(0).ruleId()).isEqualTo("r-deny-high");
    }

    @Test
    void check_wildcard_resource_id_matches_specific_resource() {
        // resourceId=null 表示通配所有 TOOL
        McpPermissionRuleEntity wildcard = rule("r-wild", "ALLOW", 0, "execute", null);
        when(repository.findCandidatesForCheck(any(), any(), any(), eq("tool-99"))).thenReturn(List.of(wildcard));

        PermissionCheckResponse resp = service.check(new PermissionCheckRequest("user-1", "TOOL", "tool-99", "execute"));

        assertThat(resp.allowed()).isTrue();
    }

    @Test
    void check_action_not_in_rule_actions_denies() {
        McpPermissionRuleEntity rule = rule("r-1", "ALLOW", 0, "read", "tool-1");
        when(repository.findCandidatesForCheck(any(), any(), any(), any())).thenReturn(List.of(rule));

        PermissionCheckResponse resp = service.check(new PermissionCheckRequest("user-1", "TOOL", "tool-1", "execute"));

        assertThat(resp.allowed()).isFalse();
        assertThat(resp.reason()).contains("无匹配规则");
    }

    @Test
    void check_disabled_rule_not_considered() {
        // repository.findCandidatesForCheck 已经过滤 enabled=TRUE，此处验证 service 依赖该契约
        when(repository.findCandidatesForCheck(any(), any(), any(), any())).thenReturn(List.of());
        PermissionCheckResponse resp = service.check(new PermissionCheckRequest("user-1", "TOOL", "tool-1", "execute"));
        assertThat(resp.allowed()).isFalse();
    }

    // ==================== 矩阵 ====================

    @Test
    void matrix_builds_subjects_resources_and_cells() {
        McpPermissionRuleEntity r1 = rule("r1", "ALLOW", 0, "execute", "tool-1");
        McpPermissionRuleEntity r2 = rule("r2", "DENY", 0, "execute", "tool-2");
        // 第二个 subject
        McpPermissionRuleEntity r3 = McpPermissionRuleEntity.builder()
                .id(3L).tenantId("tenant-default").ruleId("r3").name("rule-r3")
                .subjectType("USER").subjectId("user-2")
                .resourceType("TOOL").resourceId("tool-1")
                .actions("execute").effect("ALLOW").priority(0).enabled(true)
                .createdAt(OffsetDateTime.now()).updatedAt(OffsetDateTime.now())
                .build();
        when(repository.findAllForMatrix(any(), any(), any())).thenReturn(List.of(r1, r2, r3));

        PermissionMatrixResponse resp = service.matrix(null, null);

        assertThat(resp.subjects()).hasSize(2);
        assertThat(resp.resources()).hasSize(2);
        assertThat(resp.permissions()).hasSize(2);
        assertThat(resp.permissions().get(0)).hasSize(2);
        // user-1 × tool-1 = ALLOW
        assertThat(resp.permissions().get(0).get(0).allowed()).isTrue();
        // user-1 × tool-2 = DENY
        assertThat(resp.permissions().get(0).get(1).allowed()).isFalse();
    }

    @Test
    void matrix_empty_when_no_rules() {
        when(repository.findAllForMatrix(any(), any(), any())).thenReturn(List.of());
        PermissionMatrixResponse resp = service.matrix(null, null);
        assertThat(resp.subjects()).isEmpty();
        assertThat(resp.resources()).isEmpty();
        assertThat(resp.permissions()).isEmpty();
    }

    // ==================== 应用工具授权 ====================

    @Test
    void replaceAppToolGrants_deletes_old_and_writes_new() {
        McpPermissionRuleEntity existing = rule("old", "ALLOW", 0, "execute", "tool-old");
        when(repository.findByTenantIdAndSubjectTypeAndSubjectId(any(), eq("EXTERNAL_APP"), eq("app-1")))
                .thenReturn(List.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.replaceAppToolGrants("tenant-default", "app-1", List.of("tool-a", "tool-b"));

        verify(repository).deleteAll(List.of(existing));
        verify(repository, times(2)).save(any(McpPermissionRuleEntity.class));
    }
}
