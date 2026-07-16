package com.metaplatform.appservice.domain.form;

import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.api.error.ApiResponse;
import com.metaplatform.appservice.domain.app.AppService;
import com.metaplatform.appservice.domain.dynamic.DynamicTableService;
import com.metaplatform.appservice.domain.object.AppObjectEntity;
import com.metaplatform.appservice.domain.object.AppObjectRepository;
import com.metaplatform.appservice.security.TenantContext;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * 表单提交数据查询与导出。
 *
 * <p>路径中的 appId 支持应用 slug 或内部 Long id；formId 为 app_forms 表主键。
 */
@RestController
@RequestMapping("/api/apps/{appId}/forms/{formId}")
public class FormDataController {

    private final AppFormRepository formRepository;
    private final AppObjectRepository objectRepository;
    private final DynamicTableService dynamicTableService;
    private final AppService appService;

    public FormDataController(AppFormRepository formRepository,
                              AppObjectRepository objectRepository,
                              DynamicTableService dynamicTableService,
                              AppService appService) {
        this.formRepository = formRepository;
        this.objectRepository = objectRepository;
        this.dynamicTableService = dynamicTableService;
        this.appService = appService;
    }

    @GetMapping("/data")
    public ApiResponse<FormDataPageResult> list(
            @PathVariable String appId,
            @PathVariable Long formId,
            @RequestParam Map<String, String> params) {

        Long resolvedAppId = appService.resolveByIdOrCode(appId).getId();
        AppFormEntity form = loadForm(resolvedAppId, formId);
        String tableName = resolveTableName(resolvedAppId, form);

        FormDataQueryRequest req = buildRequest(params);
        FormDataPageResult result = dynamicTableService.queryRows(tableName, req, TenantContext.required());
        return ApiResponse.ok(result, MDC.get("traceId"));
    }

    @GetMapping("/data.csv")
    public void exportCsv(
            @PathVariable String appId,
            @PathVariable Long formId,
            @RequestParam Map<String, String> params,
            HttpServletResponse response) throws IOException {

        Long resolvedAppId = appService.resolveByIdOrCode(appId).getId();
        AppFormEntity form = loadForm(resolvedAppId, formId);
        String tableName = resolveTableName(resolvedAppId, form);

        FormDataQueryRequest req = buildRequest(params);
        req.setPage(1);
        req.setSize(Integer.MAX_VALUE);
        List<Map<String, Object>> rows = dynamicTableService.queryRowsForCsv(tableName, req, TenantContext.required());

        String filename = "export_" + form.getCode() + "_" + System.currentTimeMillis() + ".csv";
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
        response.getOutputStream().write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});

        if (rows.isEmpty()) {
            response.getOutputStream().write("无数据\n".getBytes(StandardCharsets.UTF_8));
            return;
        }

        List<String> header = new ArrayList<>(rows.get(0).keySet());
        response.getOutputStream().write((String.join(",", header) + "\n").getBytes(StandardCharsets.UTF_8));

        for (Map<String, Object> row : rows) {
            List<String> values = new ArrayList<>();
            for (String h : header) {
                values.add(escapeCsv(row.get(h)));
            }
            response.getOutputStream().write((String.join(",", values) + "\n").getBytes(StandardCharsets.UTF_8));
        }
        response.getOutputStream().flush();
    }

    private AppFormEntity loadForm(Long appId, Long formId) {
        AppFormEntity form = formRepository.findByIdAndAppId(formId, appId)
                .orElseThrow(() -> ApiException.notFound("表单不存在"));
        if (!"published".equals(form.getStatus())) {
            throw ApiException.badRequest("表单未发布，无法查看提交数据");
        }
        return form;
    }

    private String resolveTableName(Long appId, AppFormEntity form) {
        AppObjectEntity object = objectRepository.findByIdAndAppId(form.getObjectId(), appId)
                .orElseThrow(() -> ApiException.notFound("表单绑定的对象不存在"));
        String tableName = object.getDataTableName();
        if (tableName == null || tableName.isBlank()) {
            throw ApiException.internalError("对象未创建动态表");
        }
        return tableName;
    }

    private FormDataQueryRequest buildRequest(Map<String, String> params) {
        FormDataQueryRequest req = new FormDataQueryRequest();

        int page = 1;
        int size = 20;
        try {
            if (params.get("page") != null) page = Integer.parseInt(params.get("page"));
        } catch (NumberFormatException ignored) {}
        try {
            if (params.get("size") != null) size = Integer.parseInt(params.get("size"));
        } catch (NumberFormatException ignored) {}
        req.setPage(page);
        req.setSize(size);

        List<String> sort = new ArrayList<>();
        String sortParam = params.get("sort");
        if (sortParam != null && !sortParam.isBlank()) {
            sort.addAll(Arrays.asList(sortParam.split(",")));
        }
        req.setSort(sort);

        Map<String, String> filters = new LinkedHashMap<>();
        for (var entry : params.entrySet()) {
            String key = entry.getKey();
            if (key == null || "page".equals(key) || "size".equals(key)
                    || "sort".equals(key) || "columns".equals(key)) {
                continue;
            }
            filters.put(key, entry.getValue());
        }
        req.setFilters(filters);

        String columns = params.get("columns");
        if (columns != null && !columns.isBlank()) {
            req.setColumns(Arrays.asList(columns.split(",")));
        }
        return req;
    }

    private String escapeCsv(Object value) {
        if (value == null) return "";
        String s = value.toString();
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
