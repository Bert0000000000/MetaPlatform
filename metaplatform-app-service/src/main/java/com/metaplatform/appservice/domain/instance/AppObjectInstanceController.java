package com.metaplatform.appservice.domain.instance;

import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.api.error.ApiResponse;
import com.metaplatform.appservice.domain.dynamic.DynamicTableService;
import com.metaplatform.appservice.domain.form.FormDataPageResult;
import com.metaplatform.appservice.domain.form.FormDataQueryRequest;
import com.metaplatform.appservice.security.TenantContext;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * v1.0.2 B1.4: 对象实例列表 API.
 *
 * <p>路径: {@code GET /api/apps/{appId}/objects/{oid}/instances}
 *
 * <p>查询参数:
 * <ul>
 *   <li>{@code page} - 1-based 页码 (默认 1)</li>
 *   <li>{@code size} - 每页大小 (默认 20, 上限 200)</li>
 *   <li>{@code sort} - 排序字段, 逗号分隔, 前缀 {@code -} 表示降序, 例 {@code -amount,created_at}</li>
 *   <li>任意其它参数 - 视为过滤器, 语法 {@code 列名[操作符]值}, 例 {@code amount>=100}, {@code name~张}, {@code status=active}</li>
 *   <li>{@code columns} - 指定返回列, 逗号分隔, 例 {@code id,name,amount}</li>
 * </ul>
 *
 * <p>支持的操作符 (v1.0.2 B1.4):
 * <ul>
 *   <li>{@code =} 等于 / 默认精确匹配</li>
 *   <li>{@code !=} 不等于</li>
 *   <li>{@code >} / {@code <} 大于 / 小于</li>
 *   <li>{@code >=} / {@code <=} 大于等于 / 小于等于</li>
 *   <li>{@code ~} LIKE 包含</li>
 *   <li>{@code :} IS NULL</li>
 *   <li>{@code in(a,b,c)} IN 多值</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/apps/{appId}/objects/{oid}/instances")
public class AppObjectInstanceController {

    private final AppObjectInstanceService instanceService;
    private final DynamicTableService dynamicTableService;

    public AppObjectInstanceController(AppObjectInstanceService instanceService,
                                       DynamicTableService dynamicTableService) {
        this.instanceService = instanceService;
        this.dynamicTableService = dynamicTableService;
    }

    /**
     * 列表实例 (分页+排序+过滤).
     *
     * <p>返回结构:
     * <pre>
     * {
     *   "rows": [...],
     *   "total": 1234,
     *   "page": 1,
     *   "size": 20,
     *   "sort": ["-amount"],
     *   "filters": {"status": "active"}
     * }
     * </pre>
     */
    @GetMapping
    public ApiResponse<FormDataPageResult> list(
            @PathVariable String appId,
            @PathVariable Long oid,
            @RequestParam(required = false) Map<String, String> params) {
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(params);
        FormDataPageResult result = instanceService.listInstances(appId, oid, req);
        return ApiResponse.ok(result, MDC.get("traceId"));
    }

    /**
     * v1.0.2 B1.4: 创建一条对象实例 (供 e2e 测试 / 内部种子使用).
     *
     * <p>后续 Sprint 5 (form-submit) 会替代此接口, 接受 form 提交.
     * 当前为最小可用版本: 直接接收 key-value 写入动态表.
     *
     * @param appId 应用 ID 或 code
     * @param oid   对象 ID
     * @param body  字段值 (JSON object)
     * @return 插入后的实例 ID
     */
    @PostMapping
    public ApiResponse<Long> create(
            @PathVariable String appId,
            @PathVariable Long oid,
            @RequestBody Map<String, Object> body) {
        if (body == null || body.isEmpty()) {
            throw ApiException.badRequest("请求体不能为空");
        }
        Long id = instanceService.createInstance(appId, oid, body,
                TenantContext.required(), dynamicTableService);
        return ApiResponse.ok(id, MDC.get("traceId"));
    }
}