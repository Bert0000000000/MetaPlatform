package com.metaplatform.rule.decisiontable.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionTableResponse {

    private String id;
    private String tenantId;
    private String rulesetId;
    private String name;
    private String code;
    private String description;
    private String hitPolicy;

    /** 输入列（旧字段，保留以兼容现有 API 契约）。 */
    private List<DecisionTableColumnDto> inputColumns;
    /** 输出列（旧字段，保留以兼容现有 API 契约）。 */
    private List<DecisionTableColumnDto> outputColumns;

    /**
     * V11-03：合并后的列定义（inputColumns + outputColumns）。
     *
     * <p>与前端 {@code DecisionTable.columns} 对齐，columnType 标识 INPUT/OUTPUT。
     */
    private List<DecisionTableColumnDto> columns;

    /**
     * V11-03：内联行数据。
     *
     * <p>与前端 {@code DecisionTable.rows} 对齐。仅在 {@code getById} / {@code list}
     * 时由 Controller 层从 {@link DecisionTableRowService} 聚合注入；创建/更新场景可为 null。
     */
    private List<DecisionTableRowResponse> rows;

    /** 旧字段，保留以兼容现有 API 契约（取值：DRAFT/PUBLISHED/ARCHIVED）。 */
    private String status;

    /**
     * V11-03：是否启用，由 status 派生（status != ARCHIVED 即视为 true）。
     */
    private Boolean enabled;

    /**
     * V11-03：关联本体概念 ID。
     *
     * <p>当前阶段后端 schema 未独立存储 conceptId，暂以 rulesetId 兼容映射，
     * 后续 V1.2 阶段会通过 Ontology 关联表填充真实 conceptId。
     */
    private String conceptId;

    private Integer version;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}
