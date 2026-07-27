package com.metaplatform.iam.dto.snapshot;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * PermissionSnapshot 数据结构（JSON 序列化的形态）。
 *
 * <p>与 {@code iam_permission_snapshot.snapshot_data} 对应。
 * 下游 Consumer（TECH-AGENT / TECH-ONT / DeerFlow Adapter）根据这份快照判定：</p>
 *
 * <ul>
 *   <li>{@code allowedActions}：用户可执行 Ontology Action 白名单</li>
 *   <li>{@code approvalRequiredActions}：必须经过审批的高风险 Action</li>
 *   <li>{@code deniedFields}：字段级黑名单（如 bankAccount / legalIdentityNumber）</li>
 *   <li>{@code allowedRelations}：关系级白名单</li>
 *   <li>{@code dataScope} / {@code rowFilter}：行级数据范围</li>
 *   <li>{@code concepts} / {@code metrics}：当前可见的业务概念与指标</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionSnapshotDto {

    /** 数据范围：ALL / DEPARTMENT_TREE / DEPARTMENT / SELF / CUSTOM */
    private String dataScope;

    /** 行级 SQL 过滤片段（由 DataPermissionService.applyRowFilter 产出） */
    private String rowFilter;

    /** 字段级黑名单（脱敏字段） */
    private List<String> deniedFields;

    /** 关系级白名单（如 [HAS_ORDER, HAS_CONTRACT]） */
    private List<String> allowedRelations;

    /** 允许直接执行的 Action（低风险） */
    private List<String> allowedActions;

    /** 必须人工审批的 Action（高风险） */
    private List<String> approvalRequiredActions;

    /** 可见的 Concept 列表（Ontology Grounding 用） */
    private List<String> concepts;

    /** 可见的 Metric 列表 */
    private List<String> metrics;

    /** 区域 / 业务线等横向数据范围 */
    private List<String> regions;
}
