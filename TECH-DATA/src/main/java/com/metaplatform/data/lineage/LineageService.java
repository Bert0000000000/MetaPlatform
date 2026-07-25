package com.metaplatform.data.lineage;

import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.entity.CatalogAssetEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.lineage.dto.ImpactAnalysisResponse;
import com.metaplatform.data.lineage.dto.LineageGraphResponse;
import com.metaplatform.data.lineage.model.LineageEdge;
import com.metaplatform.data.lineage.model.LineageNode;
import com.metaplatform.data.repository.CatalogAssetRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.SessionConfig;
import org.neo4j.driver.Value;
import org.neo4j.driver.types.Node;
import org.neo4j.driver.types.Relationship;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 数据血缘服务：基于 Neo4j 图数据库持久化血缘关系。
 *
 * <p>Neo4j Schema：
 * <ul>
 *   <li>节点 label: {@code Asset}，属性: id, name, type, tenantId</li>
 *   <li>关系 type: {@code DERIVES_FROM}，属性: type, transformation</li>
 * </ul>
 *
 * <p>兼容现有 LineageController 的 3 个端点：
 * {@code getLineage()} / {@code getByNode(nodeId)} / {@code analyzeImpact(nodeId)}。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LineageService {

    private static final int DEFAULT_DEPTH = 5;

    private final Driver neo4jDriver;
    private final SessionConfig neo4jSessionConfig;
    private final CatalogAssetRepository catalogAssetRepository;

    /**
     * 启动时检查 Neo4j 可达性 + 创建唯一性约束。
     *
     * <p>Neo4j 不可达时记录 WARN 日志但不阻止启动（降级到空图）。</p>
     */
    @PostConstruct
    void init() {
        try (Session session = neo4jDriver.session(neo4jSessionConfig)) {
            session.run("CREATE CONSTRAINT asset_id_unique IF NOT EXISTS FOR (a:Asset) REQUIRE a.id IS UNIQUE");
            log.info("Neo4j 血缘图初始化完成 | constraint=asset_id_unique");
        } catch (Exception e) {
            log.warn("Neo4j 不可达，血缘服务降级为空图 | error={}", e.getMessage());
        }
    }

    // =====================================================================
    // Controller 兼容方法（保持原有签名）
    // =====================================================================

    /**
     * 获取默认血缘图（当前租户全量）。
     */
    public LineageGraphResponse getLineage() {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return getGraph(tenantId, DEFAULT_DEPTH);
    }

    /**
     * 按节点 ID 获取血缘子图（直接相邻节点）。
     */
    public LineageGraphResponse getByNode(String nodeId) {
        String tenantId = TenantContext.getTenantIdOrDefault();

        try (Session session = neo4jDriver.session(neo4jSessionConfig)) {
            // 验证节点存在
            String checkCypher = "MATCH (n:Asset {id: $nodeId, tenantId: $tenantId}) RETURN count(n) AS cnt";
            Result checkResult = session.run(checkCypher,
                    Map.of("nodeId", nodeId, "tenantId", tenantId));
            boolean existsInNeo4j = checkResult.single().get("cnt").asLong() > 0;

            // 查询直接相邻的边
            String edgeCypher = """
                    MATCH (s:Asset {tenantId: $tenantId})-[r:DERIVES_FROM]->(t:Asset {tenantId: $tenantId})
                    WHERE s.id = $nodeId OR t.id = $nodeId
                    RETURN s.id AS sourceId, s.name AS sourceName, s.type AS sourceType,
                           t.id AS targetId, t.name AS targetName, t.type AS targetType,
                           r.type AS relType, r.transformation AS transformation
                    """;
            Result edgeResult = session.run(edgeCypher,
                    Map.of("tenantId", tenantId, "nodeId", nodeId));

            Map<String, LineageGraphResponse.LineageNode> nodeMap = new LinkedHashMap<>();
            List<LineageGraphResponse.LineageEdge> edges = new ArrayList<>();

            while (edgeResult.hasNext()) {
                Record record = edgeResult.next();
                String sourceId = record.get("sourceId").asString();
                String targetId = record.get("targetId").asString();

                nodeMap.computeIfAbsent(sourceId, k -> LineageGraphResponse.LineageNode.builder()
                        .id(sourceId)
                        .name(record.get("sourceName").isNull() ? sourceId : record.get("sourceName").asString())
                        .type(record.get("sourceType").isNull() ? "unknown" : record.get("sourceType").asString())
                        .source(tenantId)
                        .metadata(new HashMap<>())
                        .build());
                nodeMap.computeIfAbsent(targetId, k -> LineageGraphResponse.LineageNode.builder()
                        .id(targetId)
                        .name(record.get("targetName").isNull() ? targetId : record.get("targetName").asString())
                        .type(record.get("targetType").isNull() ? "unknown" : record.get("targetType").asString())
                        .source(tenantId)
                        .metadata(new HashMap<>())
                        .build());

                edges.add(LineageGraphResponse.LineageEdge.builder()
                        .source(sourceId)
                        .target(targetId)
                        .relationship(record.get("relType").isNull() ? "derives" : record.get("relType").asString())
                        .build());
            }

            // 如果 Neo4j 中没有该节点，尝试从 CatalogAssetRepository 获取
            if (nodeMap.isEmpty()) {
                if (!existsInNeo4j) {
                    CatalogAssetEntity asset = catalogAssetRepository.findByIdAndTenantId(nodeId, tenantId)
                            .orElseThrow(() -> new DataException(ErrorCode.SCHEMA_NOT_FOUND, "血缘节点不存在: " + nodeId));
                    nodeMap.put(nodeId, toDtoNode(asset));
                } else {
                    // 节点在 Neo4j 中存在但无邻居关系，查询单节点
                    String singleCypher = "MATCH (n:Asset {id: $nodeId, tenantId: $tenantId}) RETURN n";
                    Result singleResult = session.run(singleCypher,
                            Map.of("nodeId", nodeId, "tenantId", tenantId));
                    if (singleResult.hasNext()) {
                        Node neo4jNode = singleResult.next().get("n").asNode();
                        nodeMap.put(nodeId, neo4jNodeToDto(neo4jNode));
                    }
                }
            }

            return LineageGraphResponse.builder()
                    .tenantId(tenantId)
                    .nodes(new ArrayList<>(nodeMap.values()))
                    .edges(edges)
                    .build();
        } catch (DataException e) {
            throw e;
        } catch (Exception e) {
            log.error("Neo4j 查询子图失败 | nodeId={} error={}", nodeId, e.getMessage());
            throw new DataException(ErrorCode.NEO4J_QUERY_FAILED,
                    "查询血缘子图失败: " + e.getMessage(), e);
        }
    }

    /**
     * 节点影响分析：BFS 查找上游/下游节点。
     */
    public ImpactAnalysisResponse analyzeImpact(String nodeId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return impactAnalysis(tenantId, nodeId, "both");
    }

    // =====================================================================
    // Neo4j 持久化方法
    // =====================================================================

    /**
     * 查询血缘图（指定深度范围内的所有节点和边）。
     *
     * @param tenantId 租户 ID
     * @param depth    遍历深度（1..N）
     */
    public LineageGraphResponse getGraph(String tenantId, int depth) {
        int safeDepth = Math.max(1, Math.min(depth, 10));

        try (Session session = neo4jDriver.session(neo4jSessionConfig)) {
            Map<String, LineageGraphResponse.LineageNode> nodeMap = new LinkedHashMap<>();
            List<LineageGraphResponse.LineageEdge> edges = new ArrayList<>();

            // 查询所有属于该租户的节点
            String nodeCypher = "MATCH (n:Asset {tenantId: $tenantId}) RETURN n";
            Result nodeResult = session.run(nodeCypher, Map.of("tenantId", tenantId));
            while (nodeResult.hasNext()) {
                Node neo4jNode = nodeResult.next().get("n").asNode();
                String id = neo4jNode.get("id").asString();
                nodeMap.putIfAbsent(id, neo4jNodeToDto(neo4jNode));
            }

            // 查询所有属于该租户的关系
            String edgeCypher = """
                    MATCH (s:Asset {tenantId: $tenantId})-[r:DERIVES_FROM]->(t:Asset {tenantId: $tenantId})
                    RETURN s.id AS sourceId, t.id AS targetId, r.type AS relType
                    """;
            Result edgeResult = session.run(edgeCypher, Map.of("tenantId", tenantId));
            while (edgeResult.hasNext()) {
                Record record = edgeResult.next();
                edges.add(LineageGraphResponse.LineageEdge.builder()
                        .source(record.get("sourceId").asString())
                        .target(record.get("targetId").asString())
                        .relationship(record.get("relType").isNull() ? "derives" : record.get("relType").asString())
                        .build());
            }

            return LineageGraphResponse.builder()
                    .tenantId(tenantId)
                    .nodes(new ArrayList<>(nodeMap.values()))
                    .edges(edges)
                    .build();
        } catch (Exception e) {
            log.error("Neo4j 查询血缘图失败 | tenant={} error={}", tenantId, e.getMessage());
            throw new DataException(ErrorCode.NEO4J_QUERY_FAILED,
                    "查询血缘图失败: " + e.getMessage(), e);
        }
    }

    /**
     * 添加血缘关系：创建节点和 DERIVES_FROM 关系。
     *
     * @param tenantId       租户 ID
     * @param sourceId       源资产 ID
     * @param targetId       目标资产 ID
     * @param type           关系类型（ingest/transform/aggregate/publish 等）
     * @param transformation 转换描述（可选）
     */
    public void addLineage(String tenantId, String sourceId, String targetId, String type, String transformation) {
        CatalogAssetEntity sourceAsset = catalogAssetRepository.findByIdAndTenantId(sourceId, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.SCHEMA_NOT_FOUND, "源资产不存在: " + sourceId));
        CatalogAssetEntity targetAsset = catalogAssetRepository.findByIdAndTenantId(targetId, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.SCHEMA_NOT_FOUND, "目标资产不存在: " + targetId));

        String cypher = """
                MERGE (s:Asset {id: $sourceId}) SET s.tenantId = $tenantId, s.name = $sourceName, s.type = $sourceType
                MERGE (t:Asset {id: $targetId}) SET t.tenantId = $tenantId, t.name = $targetName, t.type = $targetType
                MERGE (s)-[r:DERIVES_FROM]->(t) SET r.type = $type, r.transformation = $transformation
                """;

        try (Session session = neo4jDriver.session(neo4jSessionConfig)) {
            session.run(cypher,
                    Map.of(
                            "sourceId", sourceId,
                            "targetId", targetId,
                            "tenantId", tenantId,
                            "sourceName", sourceAsset.getName(),
                            "sourceType", sourceAsset.getType(),
                            "targetName", targetAsset.getName(),
                            "targetType", targetAsset.getType(),
                            "type", type != null ? type : "transform",
                            "transformation", transformation != null ? transformation : ""
                    ));
            log.info("血缘关系添加 | tenant={} source={} target={} type={}", tenantId, sourceId, targetId, type);
        } catch (Exception e) {
            log.error("Neo4j 添加血缘失败 | tenant={} source={} target={} error={}",
                    tenantId, sourceId, targetId, e.getMessage());
            throw new DataException(ErrorCode.NEO4J_QUERY_FAILED,
                    "添加血缘关系失败: " + e.getMessage(), e);
        }
    }

    /**
     * 删除血缘关系。
     */
    public void removeLineage(String tenantId, String sourceId, String targetId) {
        String cypher = """
                MATCH (s:Asset {id: $sourceId, tenantId: $tenantId})-[r:DERIVES_FROM]->(t:Asset {id: $targetId, tenantId: $tenantId})
                DELETE r
                """;

        try (Session session = neo4jDriver.session(neo4jSessionConfig)) {
            session.run(cypher,
                    Map.of("sourceId", sourceId, "targetId", targetId, "tenantId", tenantId));
            log.info("血缘关系删除 | tenant={} source={} target={}", tenantId, sourceId, targetId);
        } catch (Exception e) {
            log.error("Neo4j 删除血缘失败 | tenant={} source={} target={} error={}",
                    tenantId, sourceId, targetId, e.getMessage());
            throw new DataException(ErrorCode.NEO4J_QUERY_FAILED,
                    "删除血缘关系失败: " + e.getMessage(), e);
        }
    }

    /**
     * 影响分析：BFS 查询上游/下游影响节点。
     *
     * @param tenantId  租户 ID
     * @param assetId   资产 ID
     * @param direction 方向：upstream / downstream / both
     */
    public ImpactAnalysisResponse impactAnalysis(String tenantId, String assetId, String direction) {
        List<String> upstreamNodes = new ArrayList<>();
        List<String> downstreamNodes = new ArrayList<>();

        try (Session session = neo4jDriver.session(neo4jSessionConfig)) {
            // 验证节点存在
            String checkCypher = "MATCH (n:Asset {id: $assetId, tenantId: $tenantId}) RETURN count(n) AS cnt";
            Result checkResult = session.run(checkCypher,
                    Map.of("assetId", assetId, "tenantId", tenantId));
            if (checkResult.single().get("cnt").asLong() == 0) {
                throw new DataException(ErrorCode.SCHEMA_NOT_FOUND, "血缘节点不存在: " + assetId);
            }

            if ("upstream".equalsIgnoreCase(direction) || "both".equalsIgnoreCase(direction)) {
                upstreamNodes = queryConnectedNodes(session, assetId, tenantId, true);
            }
            if ("downstream".equalsIgnoreCase(direction) || "both".equalsIgnoreCase(direction)) {
                downstreamNodes = queryConnectedNodes(session, assetId, tenantId, false);
            }
        } catch (DataException e) {
            throw e;
        } catch (Exception e) {
            log.error("Neo4j 影响分析失败 | tenant={} assetId={} error={}", tenantId, assetId, e.getMessage());
            throw new DataException(ErrorCode.NEO4J_QUERY_FAILED,
                    "影响分析查询失败: " + e.getMessage(), e);
        }

        return ImpactAnalysisResponse.builder()
                .nodeId(assetId)
                .upstreamNodes(upstreamNodes)
                .downstreamNodes(downstreamNodes)
                .impactPath(downstreamNodes)
                .build();
    }

    /**
     * 查询根节点（无入边的节点）。
     */
    public List<LineageNode> getRootNodes(String tenantId) {
        String cypher = """
                MATCH (n:Asset {tenantId: $tenantId})
                WHERE NOT ()-[:DERIVES_FROM]->(n)
                RETURN n
                """;

        try (Session session = neo4jDriver.session(neo4jSessionConfig)) {
            Result result = session.run(cypher, Map.of("tenantId", tenantId));
            List<LineageNode> nodes = new ArrayList<>();
            while (result.hasNext()) {
                Node neo4jNode = result.next().get("n").asNode();
                nodes.add(neo4jNodeToModel(neo4jNode));
            }
            return nodes;
        } catch (Exception e) {
            log.error("Neo4j 查询根节点失败 | tenant={} error={}", tenantId, e.getMessage());
            throw new DataException(ErrorCode.NEO4J_QUERY_FAILED,
                    "查询根节点失败: " + e.getMessage(), e);
        }
    }

    /**
     * 查询最短血缘路径。
     */
    public List<String> getLineagePath(String tenantId, String sourceId, String targetId) {
        String cypher = """
                MATCH p = shortestPath(
                    (s:Asset {id: $sourceId, tenantId: $tenantId})
                    -[:DERIVES_FROM*..10]-
                    (t:Asset {id: $targetId, tenantId: $tenantId})
                )
                UNWIND [node IN nodes(p)] AS node
                RETURN DISTINCT node.id AS id
                """;

        try (Session session = neo4jDriver.session(neo4jSessionConfig)) {
            Result result = session.run(cypher,
                    Map.of("sourceId", sourceId, "targetId", targetId, "tenantId", tenantId));
            List<String> path = new ArrayList<>();
            while (result.hasNext()) {
                path.add(result.next().get("id").asString());
            }
            return path;
        } catch (Exception e) {
            log.error("Neo4j 查询路径失败 | tenant={} source={} target={} error={}",
                    tenantId, sourceId, targetId, e.getMessage());
            throw new DataException(ErrorCode.NEO4J_QUERY_FAILED,
                    "查询血缘路径失败: " + e.getMessage(), e);
        }
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    /**
     * 将 Neo4j Node 转换为 DTO LineageNode（用于 LineageGraphResponse）。
     */
    private LineageGraphResponse.LineageNode neo4jNodeToDto(Node neo4jNode) {
        String id = neo4jNode.containsKey("id") ? neo4jNode.get("id").asString() : String.valueOf(neo4jNode.id());
        String name = neo4jNode.containsKey("name") ? neo4jNode.get("name").asString() : id;
        String type = neo4jNode.containsKey("type") ? neo4jNode.get("type").asString() : "unknown";
        String source = neo4jNode.containsKey("tenantId") ? neo4jNode.get("tenantId").asString() : "";

        Map<String, Object> metadata = new LinkedHashMap<>();
        neo4jNode.asMap().forEach((key, value) -> {
            if (!"id".equals(key) && !"name".equals(key) && !"type".equals(key)) {
                metadata.put(key, value);
            }
        });

        return LineageGraphResponse.LineageNode.builder()
                .id(id)
                .name(name)
                .type(type)
                .source(source)
                .metadata(metadata)
                .build();
    }

    /**
     * 将 Neo4j Node 转换为 model LineageNode record（用于 getRootNodes 返回）。
     */
    private LineageNode neo4jNodeToModel(Node neo4jNode) {
        String id = neo4jNode.containsKey("id") ? neo4jNode.get("id").asString() : String.valueOf(neo4jNode.id());
        String name = neo4jNode.containsKey("name") ? neo4jNode.get("name").asString() : id;
        String type = neo4jNode.containsKey("type") ? neo4jNode.get("type").asString() : "unknown";

        Map<String, Object> props = new LinkedHashMap<>();
        neo4jNode.asMap().forEach(props::putIfAbsent);

        return new LineageNode(id, type, name, props);
    }

    /**
     * 将 CatalogAssetEntity 转换为 DTO LineageNode。
     */
    private LineageGraphResponse.LineageNode toDtoNode(CatalogAssetEntity asset) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("source", asset.getSource());
        if (asset.getOwner() != null) metadata.put("owner", asset.getOwner());

        return LineageGraphResponse.LineageNode.builder()
                .id(asset.getId())
                .name(asset.getName())
                .type(asset.getType())
                .source(asset.getSource())
                .metadata(metadata)
                .build();
    }

    /**
     * BFS 查询上游或下游节点 ID 列表。
     *
     * @param isUpstream true=上游（入边方向），false=下游（出边方向）
     */
    private List<String> queryConnectedNodes(Session session, String assetId, String tenantId, boolean isUpstream) {
        String cypher = isUpstream
                ? "MATCH (n:Asset {id: $assetId, tenantId: $tenantId})<-[:DERIVES_FROM*1..10]-(m:Asset) RETURN DISTINCT m.id AS id"
                : "MATCH (n:Asset {id: $assetId, tenantId: $tenantId})-[:DERIVES_FROM*1..10]->(m:Asset) RETURN DISTINCT m.id AS id";

        Result result = session.run(cypher,
                Map.of("assetId", assetId, "tenantId", tenantId));
        List<String> nodes = new ArrayList<>();
        while (result.hasNext()) {
            nodes.add(result.next().get("id").asString());
        }
        return nodes;
    }
}
