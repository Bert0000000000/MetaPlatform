package com.metaplatform.appservice.domain.instance;

import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.app.AppService;
import com.metaplatform.appservice.domain.dynamic.DynamicTableService;
import com.metaplatform.appservice.domain.dynamic.LookupResolver;
import com.metaplatform.appservice.domain.form.FormDataPageResult;
import com.metaplatform.appservice.domain.form.FormDataQueryRequest;
import com.metaplatform.appservice.domain.object.AppObjectEntity;
import com.metaplatform.appservice.domain.object.AppObjectRepository;
import com.metaplatform.appservice.security.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * v1.0.2 B1.4: 对象实例 (data row) 服务 — 提供分页+排序+过滤.
 *
 * <p>复用 {@link DynamicTableService#queryRows} 的全部能力, 但入口更通用:
 * 通过 {@code appId}/{@code objectId} 直接查询, 不依赖 form 是否发布.
 *
 * <p>用法 (供 Controller 调用):
 * <pre>
 *   FormDataPageResult result = service.listInstances("crm", 5L, buildReq(params));
 * </pre>
 */
@Service
public class AppObjectInstanceService {

    /** 解析查询参数 (page/size/sort/filters/columns) — 供 Controller 调用. */
    public static FormDataQueryRequest parseQueryRequest(Map<String, String> params) {
        FormDataQueryRequest req = new FormDataQueryRequest();

        int page = 1;
        int size = 20;
        try {
            if (params != null && params.get("page") != null) {
                page = Integer.parseInt(params.get("page"));
            }
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("page 必须为整数: " + params.get("page"));
        }
        try {
            if (params != null && params.get("size") != null) {
                size = Integer.parseInt(params.get("size"));
            }
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("size 必须为整数: " + params.get("size"));
        }
        req.setPage(page);
        req.setSize(size);

        List<String> sort = new java.util.ArrayList<>();
        String sortParam = params != null ? params.get("sort") : null;
        if (sortParam != null && !sortParam.isBlank()) {
            for (String s : sortParam.split(",")) {
                String trimmed = s.trim();
                if (!trimmed.isEmpty()) sort.add(trimmed);
            }
        }
        req.setSort(sort);

        Map<String, String> filters = new LinkedHashMap<>();
        if (params != null) {
            for (var entry : params.entrySet()) {
                String key = entry.getKey();
                if (key == null) continue;
                if (key.equals("page") || key.equals("size")
                        || key.equals("sort") || key.equals("columns")) {
                    continue;
                }
                // v1.0.2 B1.4: 支持两种过滤语法
                //   简单: column=value              → =value
                //   高级: column_op[op]=value       → op(value)  (避免 URL 里出现 = > < 等特殊字符)
                String expr = convertOpSuffix(key, entry.getValue());
                if (expr != null) {
                    filters.put(extractColumnName(key), expr);
                }
            }
        }
        req.setFilters(filters);

        String columns = params != null ? params.get("columns") : null;
        if (columns != null && !columns.isBlank()) {
            req.setColumns(Arrays.asList(columns.split(",")));
        }
        return req;
    }

    /**
     * v1.0.2 B1.4: 从 key 提取列名 (去掉 _op[...] 后缀).
     * <p>例:
     * <ul>
     *   <li>amount_gte → amount</li>
     *   <li>status → status (无后缀)</li>
     *   <li>name_like → name</li>
     * </ul>
     */
    static String extractColumnName(String key) {
        int idx = key.indexOf("_op[");
        if (idx >= 0) return key.substring(0, idx);
        idx = key.lastIndexOf("_");
        if (idx > 0 && SUFFIX_OPS.contains(key.substring(idx + 1))) {
            return key.substring(0, idx);
        }
        return key;
    }

    /** v1.0.2 B1.4: key_op[op]=value → op(value) 表达式. */
    static String convertOpSuffix(String key, String value) {
        // 形式 1: column_op[op]=value
        int bracketStart = key.indexOf("_op[");
        if (bracketStart >= 0 && key.endsWith("]")) {
            String column = key.substring(0, bracketStart);
            String op = key.substring(bracketStart + 4, key.length() - 1);
            return wrapOp(op, value);
        }
        // 形式 2: column_op=value (op 是已知后缀)
        int us = key.lastIndexOf("_");
        if (us > 0 && SUFFIX_OPS.contains(key.substring(us + 1))) {
            String op = key.substring(us + 1);
            return wrapOp(op, value);
        }
        // 形式 3: column=value (简单, 不带 op 后缀) — 等于操作
        return "=" + value;
    }

    /** 操作符后缀白名单 (小写). */
    static final java.util.Set<String> SUFFIX_OPS = java.util.Set.of(
            "eq", "neq", "gt", "gte", "lt", "lte", "like", "in", "isnull");

    /** 把操作符缩写转换为 FilterParser 接受的表达式. */
    private static String wrapOp(String op, String value) {
        return switch (op) {
            case "eq" -> "=" + value;
            case "neq" -> "!=" + value;
            case "gt" -> ">" + value;
            case "gte" -> ">=" + value;
            case "lt" -> "<" + value;
            case "lte" -> "<=" + value;
            case "like" -> "~" + value;
            case "in" -> "in(" + value + ")";
            case "isnull" -> ":";
            default -> throw ApiException.badRequest("不支持的操作符: " + op);
        };
    }

    private final AppService appService;
    private final AppObjectRepository objectRepository;
    private final DynamicTableService dynamicTableService;
    private final LookupResolver lookupResolver;

    public AppObjectInstanceService(AppService appService,
                                    AppObjectRepository objectRepository,
                                    DynamicTableService dynamicTableService,
                                    LookupResolver lookupResolver) {
        this.appService = appService;
        this.objectRepository = objectRepository;
        this.dynamicTableService = dynamicTableService;
        this.lookupResolver = lookupResolver;
    }

    /**
     * 列出对象实例, 支持分页/排序/过滤 + lookup 字段连表解析.
     *
     * @param appRef  应用 ID 或 code
     * @param oid     对象 ID
     * @param req     查询参数 (page/size/sort/filters/columns)
     * @return 分页结果 (rows 中 lookup 字段已替换为 displayField 值)
     */
    @Transactional(readOnly = true)
    public FormDataPageResult listInstances(String appRef, Long oid, FormDataQueryRequest req) {
        Long appId = appService.resolveByIdOrCode(appRef).getId();
        AppObjectEntity object = objectRepository.findByIdAndAppId(oid, appId)
                .orElseThrow(() -> ApiException.notFound("对象 " + oid + " 不存在"));
        String tableName = object.getDataTableName();
        if (tableName == null || tableName.isBlank()) {
            // 对象还没有动态表 (e.g. 0 字段对象), 返回空分页
            return new FormDataPageResult(
                    java.util.List.of(), 0L,
                    req.getPage(), req.getSize(),
                    req.getSort(), req.getFilters());
        }
        FormDataPageResult result = dynamicTableService.queryRows(tableName, req, TenantContext.required());
        // v1.0.2 B1.5: lookup 字段连表查询 — 把 FK ID 替换为 displayField 值
        List<java.util.Map<String, Object>> resolvedRows =
                lookupResolver.resolveBatch(object, result.getRows(), TenantContext.required());
        return new FormDataPageResult(
                resolvedRows, result.getTotal(),
                result.getPage(), result.getSize(),
                result.getSort(), result.getFilters());
    }

    /**
     * v1.0.2 B1.4: 创建一条对象实例 (供 e2e 测试 / Sprint 5 form-submit 用).
     *
     * <p>当前为最小可用: 直接接收 key-value 写入动态表, 不做字段类型校验.
     * 后续 Sprint 5 会被 form-submit 流程取代.
     */
    @Transactional
    public Long createInstance(String appRef, Long oid, Map<String, Object> row,
                               String tenantId, DynamicTableService tableService) {
        Long appId = appService.resolveByIdOrCode(appRef).getId();
        AppObjectEntity object = objectRepository.findByIdAndAppId(oid, appId)
                .orElseThrow(() -> ApiException.notFound("对象 " + oid + " 不存在"));
        String tableName = object.getDataTableName();
        if (tableName == null || tableName.isBlank()) {
            throw ApiException.badRequest("对象 " + oid + " 未创建动态表");
        }
        return tableService.insertRow(tableName, row, tenantId, "system");
    }
}