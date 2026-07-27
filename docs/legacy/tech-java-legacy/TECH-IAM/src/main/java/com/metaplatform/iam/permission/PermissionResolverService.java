package com.metaplatform.iam.permission;

import com.metaplatform.iam.dto.datapermission.DataScopeResolveResponse;
import com.metaplatform.iam.entity.DataPermissionEntity;
import com.metaplatform.iam.service.DataPermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * 对象级 / 字段级 / 关系级 / Action 级权限解析器（P0.2.2 / P0.2.3）。
 *
 * <p>承担 Ontology-Native DeerFlow 的核心安全职责：</p>
 *
 * <ul>
 *   <li>{@link #resolveFieldMask(String, String, String)}：返回字段级脱敏列表</li>
 *   <li>{@link #filterRelatedObjects(String, String, String, List)}：关系级白名单过滤</li>
 *   <li>{@link #resolveAllowedActions(String, String, List)}：Action 级白名单</li>
 *   <li>{@link #resolveApprovalRequiredActions(String, String)}：必须审批的 Action 列表</li>
 * </ul>
 *
 * <p>策略来源：现有 iam_data_permission（DataPermissionService）+ P5.1 将注册的
 * ActionPolicy YAML。P0.2 阶段先复用 DataPermission 的字段脱敏与数据范围，Action 列表
 * 由调用方传入（占位实现，后续 P5.1 接 ActionPolicy）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PermissionResolverService {

    private final DataPermissionService dataPermissionService;

    /**
     * 字段级脱敏：根据当前对象 Concept + 用户角色返回需要遮罩的字段。
     *
     * @param tenantId     租户
     * @param userId       用户
     * @param conceptCode  对象类型（如 Customer / Order / Contract）
     * @return 需要脱敏的字段名列表（黑名单形式）
     */
    public List<String> resolveFieldMask(String tenantId, String userId, String conceptCode) {
        // P0.2 占位：复用 DataPermissionService.resolveColumnFilter（按 resourceType）
        // 实际 conceptCode 与 resourceType 的映射在 P1.2 由 TECH-ONT 提供 Ontology Schema 转换层
        DataScopeResolveResponse resp = dataPermissionService.resolve(
                userId, Collections.emptyList(), conceptCode);
        if (resp == null || resp.getColumnFilter() == null) {
            return Collections.emptyList();
        }
        return new ArrayList<>(resp.getColumnFilter());
    }

    /**
     * 关系级白名单过滤：返回用户在当前 Concept 上可访问的关系列表。
     *
     * @param tenantId    租户
     * @param userId      用户
     * @param conceptCode 对象类型
     * @param candidates  候选关系名列表
     * @return 允许的关系子集
     */
    public List<String> filterRelatedObjects(String tenantId, String userId,
                                              String conceptCode, List<String> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return Collections.emptyList();
        }
        // P0.2 占位：默认放行所有关系，P1.2 由 Ontology Schema 的 relation.allowedRoles 字段驱动
        // 这里保留接口，P1.2 接入 iam_role.action_scope
        log.debug("[PermissionResolver] filterRelatedObjects tenant={} user={} concept={} -> 暂放行 {} 条",
                tenantId, userId, conceptCode, candidates.size());
        return new ArrayList<>(candidates);
    }

    /**
     * Action 级白名单：从 candidates 中过滤出用户被授权的 Action。
     *
     * @param tenantId     租户
     * @param userId       用户
     * @param candidates   候选 Action 列表
     * @return 允许的 Action 子集
     */
    public List<String> resolveAllowedActions(String tenantId, String userId, List<String> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return Collections.emptyList();
        }
        // P0.2 占位：默认返回 candidates 中以 "View" 开头或显式注册到 iam_role.action_scope 的项
        // P5.1 接 ActionPolicy.yaml 后将按风险等级 + 角色双因素过滤
        return candidates.stream()
                .filter(Objects::nonNull)
                .filter(a -> !a.startsWith("Admin"))
                .toList();
    }

    /**
     * 必须人工审批的 Action（高风险）。
     *
     * @param tenantId    租户
     * @param userId      用户
     * @return 需审批的 Action 列表（默认与 Object 类型绑定的高风险 Action）
     */
    public List<String> resolveApprovalRequiredActions(String tenantId, String userId) {
        // P0.2 占位：默认返回通用高风险 Action；P5.1 由 ActionPolicy 提供 role-aware 决策
        return Arrays.asList(
                "ChangeDiscount",
                "SendOfficialOffer",
                "ModifyContract",
                "ChangeCustomerRiskLevel"
        );
    }

    /**
     * 数据范围解析（委托给现有 DataPermissionService）。
     */
    public DataScopeResolveResponse resolveDataScope(String tenantId, String userId,
                                                      List<String> roleIds, String resourceType) {
        return dataPermissionService.resolve(userId, roleIds, resourceType);
    }

    /**
     * 把 DataScope enum 映射为字符串。
     */
    public String scopeToString(DataPermissionEntity.DataScope scope) {
        return scope == null ? "SELF" : scope.name();
    }
}
