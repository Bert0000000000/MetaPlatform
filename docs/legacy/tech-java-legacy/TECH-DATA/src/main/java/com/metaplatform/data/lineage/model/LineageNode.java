package com.metaplatform.data.lineage.model;

import java.util.Map;

/**
 * 血缘节点内部模型（Neo4j Asset 节点映射）。
 *
 * <p>与 DTO {@link com.metaplatform.data.lineage.dto.LineageGraphResponse.LineageNode}
 * 区分，此 record 用于 Neo4j 查询结果的中间表示。</p>
 *
 * @param id         节点 ID（对应 CatalogAssetEntity.id）
 * @param type       节点类型（datasource / table / view / deliverable 等）
 * @param name       节点名称
 * @param properties 额外属性（tenantId / source / owner 等）
 */
public record LineageNode(String id, String type, String name, Map<String, Object> properties) {
}
