package com.metaplatform.appservice.domain.dynamic;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.object.AppObjectEntity;
import com.metaplatform.appservice.domain.object.AppObjectRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * v1.0.2 B1.5: lookup 字段连表查询 — 把 FK ID 解析为目标对象的 displayField 值.
 *
 * <p>核心方法:
 * <ul>
 *   <li>{@link #parseSchemaLookups(String)} — 解析 schema_json, 返回所有 lookup 字段定义</li>
 *   <li>{@link #resolveBatch(AppObjectEntity, List, String)} — 批量解析一组 row</li>
 *   <li>{@link #resolveSingle(AppObjectEntity, Map, String)} — 解析单条 row (用于 POST instances 返回)</li>
 * </ul>
 *
 * <p>性能策略: 批查 — 同 objectId 多个 FK ID 用一次 {@code IN (?,?,?,...)} 查询, 避免 N+1.
 *
 * <p>输出 row 新增字段命名约定:
 * <ul>
 *   <li>{@code <lookup_code>} — displayField 的值 (替代 FK ID 显示)</li>
 *   <li>{@code <lookup_code>_id} — 原始 FK ID (保留, 与 lookup_code 形成映射)</li>
 * </ul>
 */
@Service
public class LookupResolver {

    private final AppObjectRepository objectRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper mapper = new ObjectMapper();

    public LookupResolver(AppObjectRepository objectRepository,
                          JdbcTemplate jdbcTemplate) {
        this.objectRepository = objectRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    /** lookup 字段定义 (从 schema_json 解析出). */
    public record LookupFieldDef(
            String column,           // 当前 row 中的列名 (FK ID 列)
            String displayField,     // 目标对象的 displayField
            Long targetObjectId,     // 目标对象的 ID
            String targetTableName   // 目标对象的物理表名 (resolved)
    ) {}

    /**
     * 解析 schema_json 找出所有 lookup 字段定义.
     */
    public List<LookupFieldDef> parseSchemaLookups(String schemaJson) {
        if (schemaJson == null || schemaJson.isBlank()) {
            return List.of();
        }
        List<LookupFieldDef> result = new ArrayList<>();
        try {
            JsonNode arr = mapper.readTree(schemaJson);
            if (!arr.isArray()) return List.of();
            for (JsonNode field : arr) {
                JsonNode typeNode = field.get("type");
                JsonNode codeNode = field.get("code");
                JsonNode lookupNode = field.get("lookup");
                if (typeNode == null || !"lookup".equals(typeNode.asText())) continue;
                if (codeNode == null) continue;
                if (lookupNode == null) continue;
                JsonNode targetIdNode = lookupNode.get("objectId");
                JsonNode displayFieldNode = lookupNode.get("displayField");
                if (targetIdNode == null || displayFieldNode == null) continue;
                result.add(new LookupFieldDef(
                        codeNode.asText(),
                        displayFieldNode.asText(),
                        targetIdNode.asLong(),
                        null  // targetTableName 在 resolve 时动态解析
                ));
            }
        } catch (Exception e) {
            throw ApiException.internalError("schema_json 解析失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * 解析单条 row: 把 lookup 字段的 FK ID 替换为 displayField 值.
     *
     * <p>输入 row 形如: { customer_id: 5 }
     * <p>输出 row 形如: { customer_id: 5, customer: "张老板" }
     *
     * @param sourceObj 当前数据所属对象 (提供 schema)
     * @param row       单条 row (Map<String, Object>)
     * @param tenantId  租户 ID (用于查询目标对象)
     * @return 增强后的 row (原 row 字段保留, 新增 displayField 列)
     */
    @Transactional(readOnly = true)
    public Map<String, Object> resolveSingle(AppObjectEntity sourceObj, Map<String, Object> row, String tenantId) {
        return resolveBatch(sourceObj, List.of(row), tenantId).get(0);
    }

    /**
     * 批量解析多行: 把所有 lookup 字段的 FK ID 替换为 displayField 值.
     *
     * <p>批查策略:
     * <ul>
     *   <li>解析 schema 提取所有 lookup 字段定义</li>
     *   <li>按 (targetObjectId) 分组, 收集所有需要查询的 FK ID</li>
     *   <li>对每个 targetObjectId 执行一次 SELECT id, displayField FROM target_table WHERE id IN (...) AND tenant_id=?</li>
     *   <li>填充到 row 中, 不修改原始 row (返回 LinkedHashMap copy)</li>
     * </ul>
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> resolveBatch(AppObjectEntity sourceObj, List<Map<String, Object>> rows, String tenantId) {
        if (rows == null || rows.isEmpty()) return rows;
        List<LookupFieldDef> lookupFields = parseSchemaLookups(sourceObj.getSchemaJson());
        if (lookupFields.isEmpty()) return rows;

        // Step 1: 解析 lookup 字段的目标对象 (去重 + 加载表名)
        //   key: objectId, value: AppObjectEntity
        Set<Long> targetObjectIds = new HashSet<>();
        for (LookupFieldDef lf : lookupFields) targetObjectIds.add(lf.targetObjectId());
        Map<Long, AppObjectEntity> targetObjects = new HashMap<>();
        for (Long id : targetObjectIds) {
            AppObjectEntity e = objectRepository.findById(id).orElse(null);
            if (e != null && e.getDataTableName() != null) {
                targetObjects.put(id, e);
            }
        }

        // Step 2: 按 (targetObjectId, displayField) 分组批查
        //   groupKey: objectId + "_" + displayField
        //   cacheKey: lookupField 的 column 名 → 解析后的 display value
        //   实际 SQL 执行以 groupKey 为单位
        Map<String, Map<Object, Object>> idToDisplayByGroup = new LinkedHashMap<>();
        Map<Long, AppObjectEntity> finalTargets = targetObjects;
        for (LookupFieldDef lf : lookupFields) {
            AppObjectEntity target = finalTargets.get(lf.targetObjectId());
            if (target == null) continue;
            String groupKey = lf.targetObjectId() + "|" + lf.displayField();
            if (idToDisplayByGroup.containsKey(groupKey)) continue;
            Set<Object> ids = new HashSet<>();
            for (Map<String, Object> row : rows) {
                Object v = row.get(lf.column());
                if (v != null) ids.add(v);
            }
            if (ids.isEmpty()) {
                idToDisplayByGroup.put(groupKey, Map.of());
                continue;
            }
            Map<Object, Object> idToDisplay = batchLookupDisplay(
                    target.getDataTableName(), lf.displayField(), ids, tenantId);
            idToDisplayByGroup.put(groupKey, idToDisplay);
        }

        // Step 3: 增强 row: 用 displayField 值替换 FK ID 列
        List<Map<String, Object>> result = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            Map<String, Object> enhanced = new LinkedHashMap<>(row);
            for (LookupFieldDef lf : lookupFields) {
                String groupKey = lf.targetObjectId() + "|" + lf.displayField();
                Map<Object, Object> idToDisplay = idToDisplayByGroup.get(groupKey);
                if (idToDisplay == null) continue;
                Object fkId = row.get(lf.column());
                if (fkId == null) continue;  // NULL FK 不解析, 保持 null
                Object displayValue = idToDisplay.get(fkId);
                if (displayValue != null) {
                    enhanced.put(lf.column(), displayValue);
                }
                // displayValue 为 null 时保留原始 FK ID (便于排查目标被删)
            }
            result.add(enhanced);
        }
        return result;
    }

    /**
     * 批查 displayField 值: 一次 SQL 查所有 ids.
     */
    private Map<Object, Object> batchLookupDisplay(String targetTableName, String displayField,
                                                   Collection<Object> ids, String tenantId) {
        // 校验 table name 防止 SQL 注入
        if (!TABLE_NAME_PATTERN.matcher(targetTableName).matches()) {
            return Map.of();
        }
        // 校验 displayField 防 SQL 注入
        if (!IDENT_PATTERN.matcher(displayField).matches()) {
            return Map.of();
        }
        if (ids.isEmpty()) return Map.of();

        // 构造 WHERE id IN (?,?,?,...) AND tenant_id=?
        StringBuilder sql = new StringBuilder("SELECT id, ")
                .append(displayField)
                .append(" FROM ")
                .append(targetTableName)
                .append(" WHERE tenant_id = ? AND id IN (");
        List<Object> args = new ArrayList<>();
        args.add(tenantId);
        int i = 0;
        for (Object id : ids) {
            if (i > 0) sql.append(",");
            sql.append("?");
            args.add(id);
            i++;
        }
        sql.append(")");

        Map<Object, Object> result = new HashMap<>();
        jdbcTemplate.query(sql.toString(), (rs, rn) -> {
            result.put(rs.getObject("id"), rs.getObject(displayField));
            return null;
        }, args.toArray());
        return result;
    }

    /** 表名白名单 (DynamicTableService 同样规则). */
    private static final Pattern TABLE_NAME_PATTERN = Pattern.compile("^data_[a-z][a-z0-9_]+$");
    private static final Pattern IDENT_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{0,62}$");
}