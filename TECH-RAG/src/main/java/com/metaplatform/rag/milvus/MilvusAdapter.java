package com.metaplatform.rag.milvus;

import io.milvus.client.MilvusServiceClient;
import io.milvus.grpc.DataType;
import io.milvus.grpc.SearchResultData;
import io.milvus.grpc.SearchResults;
import io.milvus.param.MilvusParam;
import io.milvus.param.R;
import io.milvus.param.collection.CreateCollectionParam;
import io.milvus.param.collection.FieldType;
import io.milvus.param.dml.InsertParam;
import io.milvus.param.dml.SearchParam;
import io.milvus.param.index.CreateIndexParam;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Milvus 向量库适配器（P2.2.1）。
 *
 * <p>封装：</p>
 * <ul>
 *   <li>连接管理（基于 milvus-sdk-java）</li>
 *   <li>Collection 自动创建（{@code rag_chunks_v1}）</li>
 *   <li>向量 upsert / search / delete</li>
 * </ul>
 *
 * <p>P2.2 阶段：直接使用 milvus-sdk-java 客户端；P8.3 替换为 Spring AI VectorStore。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MilvusAdapter {

    @Value("${spring.ai.vectorstore.milvus.client.host:localhost}")
    private String host;

    @Value("${spring.ai.vectorstore.milvus.client.port:19530}")
    private int port;

    @Value("${spring.ai.vectorstore.milvus.collection-name:rag_chunks}")
    private String collectionName;

    @Value("${spring.ai.vectorstore.milvus.embedding-dimension:1024}")
    private int dimension;

    private MilvusServiceClient client;

    @PostConstruct
    public void init() {
        try {
            MilvusParam.ConnectParam connectParam = MilvusParam.ConnectParam.newBuilder()
                    .withHost(host)
                    .withPort(port)
                    .build();
            client = new MilvusServiceClient(connectParam);
            ensureCollection();
            log.info("[MilvusAdapter] connected host={}:{} collection={} dim={}",
                    host, port, collectionName, dimension);
        } catch (Exception e) {
            log.warn("[MilvusAdapter] 连接失败，将以降级模式运行: {}", e.getMessage());
        }
    }

    /**
     * 写入或更新向量。
     *
     * @return 写入的 vector id（在 Milvus 中由 auto-id 生成）
     */
    public String upsert(String chunkId, String kbId, String tenantId,
                         List<Float> vector, Map<String, Object> payload) {
        if (client == null) {
            log.warn("[MilvusAdapter] 客户端未连接，跳过 upsert chunkId={}", chunkId);
            return null;
        }
        try {
            List<InsertParam.Field> fields = List.of(
                    new InsertParam.Field("chunk_id", DataType.VarChar, List.of(chunkId)),
                    new InsertParam.Field("kb_id", DataType.VarChar, List.of(kbId)),
                    new InsertParam.Field("tenant_id", DataType.VarChar, List.of(tenantId)),
                    new InsertParam.Field("vector", DataType.FloatVector,
                            List.of(toFloats(vector)))
            );
            InsertParam param = InsertParam.newBuilder()
                    .withCollectionName(collectionName)
                    .withFields(fields)
                    .build();
            R<io.milvus.grpc.MutationResult> resp = client.insert(param);
            if (resp.getStatus() != R.Status.Success.getCode()) {
                log.warn("[MilvusAdapter] upsert failed chunkId={} status={}", chunkId, resp.getStatus());
                return null;
            }
            // 返回 Milvus auto-id
            return String.valueOf(resp.getData().getIds(0));
        } catch (Exception e) {
            log.warn("[MilvusAdapter] upsert error chunkId={}", chunkId, e);
            return null;
        }
    }

    /**
     * 向量检索。
     *
     * @return Milvus 返回的 id 列表，按距离排序
     */
    public List<String> search(List<Float> queryVector, int topK, String expr) {
        if (client == null) {
            return Collections.emptyList();
        }
        try {
            SearchParam param = SearchParam.newBuilder()
                    .withCollectionName(collectionName)
                    .withTopK(topK)
                    .withVectors(List.of(toFloats(queryVector)))
                    .withVectorFieldName("vector")
                    .withExpr(expr == null || expr.isBlank() ? "tenant_id != ''" : expr)
                    .withMetricType(io.milvus.param.MetricType.COSINE)
                    .build();
            R<SearchResults> resp = client.search(param);
            if (resp.getStatus() != R.Status.Success.getCode() || resp.getData() == null) {
                return Collections.emptyList();
            }
            SearchResultData data = resp.getData();
            List<String> ids = new ArrayList<>();
            for (var hit : data.getResultsList()) {
                ids.add(String.valueOf(hit.getIdsList().get(0)));
            }
            return ids;
        } catch (Exception e) {
            log.warn("[MilvusAdapter] search error", e);
            return Collections.emptyList();
        }
    }

    private void ensureCollection() {
        try {
            R<Boolean> has = client.hasCollection(
                    io.milvus.param.collection.HasCollectionParam.newBuilder()
                            .withCollectionName(collectionName).build());
            if (has.getData() != null && has.getData()) {
                return;
            }
            FieldType idField = FieldType.newBuilder()
                    .withName("id").withDataType(DataType.Int64).withPrimaryKey(true).withAutoID(true).build();
            FieldType chunkIdField = FieldType.newBuilder()
                    .withName("chunk_id").withDataType(DataType.VarChar).withMaxLength(64).build();
            FieldType kbIdField = FieldType.newBuilder()
                    .withName("kb_id").withDataType(DataType.VarChar).withMaxLength(64).build();
            FieldType tenantIdField = FieldType.newBuilder()
                    .withName("tenant_id").withDataType(DataType.VarChar).withMaxLength(64).build();
            FieldType vectorField = FieldType.newBuilder()
                    .withName("vector").withDataType(DataType.FloatVector).withDimension(dimension).build();

            CreateCollectionParam createParam = CreateCollectionParam.newBuilder()
                    .withCollectionName(collectionName)
                    .addFieldType(idField)
                    .addFieldType(chunkIdField)
                    .addFieldType(kbIdField)
                    .addFieldType(tenantIdField)
                    .addFieldType(vectorField)
                    .build();
            client.createCollection(createParam);

            // 创建 IVF_FLAT 索引
            CreateIndexParam indexParam = CreateIndexParam.newBuilder()
                    .withCollectionName(collectionName)
                    .withFieldName("vector")
                    .withIndexType(io.milvus.param.IndexType.IVF_FLAT)
                    .withMetricType(io.milvus.param.MetricType.COSINE)
                    .withExtraParam("{\"nlist\":1024}")
                    .build();
            client.createIndex(indexParam);
            log.info("[MilvusAdapter] collection {} created", collectionName);
        } catch (Exception e) {
            log.warn("[MilvusAdapter] ensureCollection failed: {}", e.getMessage());
        }
    }

    private List<Float> toFloats(List<Float> v) {
        return v == null ? Collections.emptyList() : v;
    }

    private float[] toFloatsArray(List<Float> v) {
        float[] arr = new float[v.size()];
        for (int i = 0; i < v.size(); i++) arr[i] = v.get(i);
        return arr;
    }
}
