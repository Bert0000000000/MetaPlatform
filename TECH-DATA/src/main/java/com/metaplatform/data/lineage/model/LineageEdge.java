package com.metaplatform.data.lineage.model;

import java.util.Map;

/**
 * 血缘边内部模型（Neo4j DERIVES_FROM 关系映射）。
 *
 * @param sourceId  源节点 ID
 * @param targetId  目标节点 ID
 * @param type      关系类型（ingest / transform / aggregate / publish 等）
 * @param properties 额外属性（transformation 描述等）
 */
public record LineageEdge(String sourceId, String targetId, String type, Map<String, Object> properties) {
}
