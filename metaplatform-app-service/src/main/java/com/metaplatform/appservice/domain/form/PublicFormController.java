package com.metaplatform.appservice.domain.form;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.api.error.ApiResponse;
import com.metaplatform.appservice.domain.app.AppRepository;
import com.metaplatform.appservice.domain.dynamic.DynamicTableService;
import com.metaplatform.appservice.domain.object.AppObjectEntity;
import com.metaplatform.appservice.domain.object.AppObjectRepository;
import com.metaplatform.appservice.security.TenantContext;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 公开表单访问接口（无需 JWT）。
 */
@RestController
@RequestMapping("/api/public/forms")
public class PublicFormController {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final AppFormRepository formRepository;
    private final AppRepository appRepository;
    private final AppObjectRepository objectRepository;
    private final FormSubmissionService submissionService;
    private final DynamicTableService dynamicTableService;

    public PublicFormController(AppFormRepository formRepository,
                                AppRepository appRepository,
                                AppObjectRepository objectRepository,
                                FormSubmissionService submissionService,
                                DynamicTableService dynamicTableService) {
        this.formRepository = formRepository;
        this.appRepository = appRepository;
        this.objectRepository = objectRepository;
        this.submissionService = submissionService;
        this.dynamicTableService = dynamicTableService;
    }

    @GetMapping("/{formId}")
    public ApiResponse<Map<String, Object>> getPublishedForm(@PathVariable Long formId) {
        var form = loadPublishedForm(formId);
        Object schema = parseSchema(form.getSchemaJson());
        return ApiResponse.ok(Map.of(
                "id", form.getId(),
                "name", form.getName(),
                "boundObjectId", String.valueOf(form.getObjectId()),
                "schema", schema
        ), MDC.get("traceId"));
    }

    /**
     * 公开查询表单字段的查找选项（无需 JWT）。用于下拉、单选等控件动态加载候选项。
     */
    @GetMapping("/{formId}/lookup-options")
    public ApiResponse<List<Map<String, Object>>> listLookupOptions(@PathVariable Long formId) {
        var form = loadPublishedForm(formId);
        setTenantContext(form.getAppId());
        try {
            Map<String, Object> schema = LookupFieldExtractor.parseSchema(form.getSchemaJson());
            List<Map<String, String>> lookups = LookupFieldExtractor.extract(schema);
            List<Map<String, Object>> options = new ArrayList<>();
            for (Map<String, String> lk : lookups) {
                String fieldKey = lk.get("field");
                String objectIdStr = lk.get("objectId");
                String displayField = lk.get("displayField");
                long objectId;
                try { objectId = Long.parseLong(objectIdStr); } catch (NumberFormatException nfe) { continue; }
                List<Map<String, Object>> targetRows = loadTargetOptions(objectId, displayField);
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("field", fieldKey);
                entry.put("options", targetRows);
                options.add(entry);
            }
            return ApiResponse.ok(options, MDC.get("traceId"));
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * 公开查询表单提交数据（无需 JWT）。用于申请人提交后查看历史记录。
     */
    /**
     * 公开查询表单提交记录（无需 JWT）。返回 form_submissions 中的记录，比 /data 更适合审批场景。
     */
    @GetMapping("/{formId}/submissions")
    public ApiResponse<FormDataPageResult> listSubmissions(
            @PathVariable Long formId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sort) {

        var form = loadPublishedForm(formId);
        setTenantContext(form.getAppId());
        try {
            List<FormSubmissionEntity> all = submissionService.listByFormId(formId);
            int total = all.size();
            int pageIndex = Math.max(1, page);
            int pageSize = Math.min(Math.max(1, size), 200);
            int from = (pageIndex - 1) * pageSize;
            int to = Math.min(from + pageSize, total);
            List<FormSubmissionEntity> pageItems = from < total ? all.subList(from, to) : List.of();

            List<Map<String, Object>> rows = new ArrayList<>();
            for (FormSubmissionEntity s : pageItems) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", s.getId());
                row.put("created_at", s.getCreatedAt() != null ? s.getCreatedAt().toString() : null);
                row.put("updated_at", s.getUpdatedAt() != null ? s.getUpdatedAt().toString() : null);
                row.put("workflow_status", s.getWorkflowStatus());
                row.put("process_instance_id", s.getProcessInstanceId());
                row.put("current_task_name", s.getCurrentTaskName());
                row.put("submitter_name", s.getSubmitterName());
                row.put("submitter_email", s.getSubmitterEmail());
                Map<String, Object> values = parseValues(s.getValuesJson());
                row.putAll(values);
                rows.add(row);
            }

            FormDataPageResult result = new FormDataPageResult();
            result.setRows(rows);
            result.setTotal(total);
            result.setPage(pageIndex);
            result.setSize(pageSize);
            result.setSort(sort != null ? Arrays.asList(sort.split(",")) : Collections.emptyList());
            result.setFilters(Collections.emptyMap());
            return ApiResponse.ok(result, MDC.get("traceId"));
        } finally {
            TenantContext.clear();
        }
    }

    @GetMapping("/{formId}/data")
    public ApiResponse<FormDataPageResult> listData(
            @PathVariable Long formId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sort,
            @RequestParam Map<String, String> params) {

        var form = loadPublishedForm(formId);
        setTenantContext(form.getAppId());
        try {
            String tableName = resolveTableName(form);
            FormDataQueryRequest req = buildPublicRequest(page, size, sort, params);
            FormDataPageResult result = dynamicTableService.queryRows(tableName, req, TenantContext.required());
            return ApiResponse.ok(result, MDC.get("traceId"));
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * 公开 CSV 导出（无需 JWT）。
     */
    @GetMapping("/{formId}/data.csv")
    public void exportCsv(
            @PathVariable Long formId,
            @RequestParam(required = false) String sort,
            @RequestParam Map<String, String> params,
            HttpServletResponse response) throws IOException {

        var form = loadPublishedForm(formId);
        setTenantContext(form.getAppId());
        try {
            String tableName = resolveTableName(form);
            FormDataQueryRequest req = buildPublicRequest(1, Integer.MAX_VALUE, sort, params);
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
        } finally {
            TenantContext.clear();
        }
    }

    private String resolveTableName(AppFormEntity form) {
        AppObjectEntity object = objectRepository.findById(form.getObjectId())
                .orElseThrow(() -> ApiException.notFound("表单绑定的对象不存在"));
        String tableName = object.getDataTableName();
        if (tableName == null || tableName.isBlank()) {
            throw ApiException.internalError("对象未创建动态表");
        }
        return tableName;
    }

    private String escapeCsv(Object value) {
        if (value == null) return "";
        String s = value.toString();
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    @PostMapping("/{formId}/submit")
    public ApiResponse<Map<String, Long>> submit(@PathVariable Long formId,
                                                  @RequestBody Map<String, Object> body) {
        var form = loadPublishedForm(formId);
        setTenantContext(form.getAppId());
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> values = (Map<String, Object>) body.getOrDefault("values", Map.of());
            Long rowId = submissionService.submit(formId, values);
            return ApiResponse.ok(Map.of("id", rowId), MDC.get("traceId"));
        } finally {
            TenantContext.clear();
        }
    }

    private AppFormEntity loadPublishedForm(Long formId) {
        var form = formRepository.findById(formId)
                .orElseThrow(() -> ApiException.notFound("表单不存在"));
        if (!"published".equals(form.getStatus())) {
            throw ApiException.badRequest("表单未发布");
        }
        return form;
    }

    private void setTenantContext(Long appId) {
        appRepository.findById(appId).ifPresent(app -> {
            String tenantId = app.getTenantId();
            if (tenantId != null && !tenantId.isBlank()) {
                TenantContext.set(tenantId);
            }
        });
    }

    private Object parseSchema(String schemaJson) {
        if (schemaJson == null || schemaJson.isBlank()) return Map.of();
        try {
            return MAPPER.readValue(schemaJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            throw ApiException.internalError("表单 schema 解析失败");
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseValues(String valuesJson) {
        if (valuesJson == null || valuesJson.isBlank()) return Map.of();
        try {
            return MAPPER.readValue(valuesJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private FormDataQueryRequest buildPublicRequest(int page, int size, String sort, Map<String, String> params) {
        FormDataQueryRequest req = new FormDataQueryRequest();
        req.setPage(Math.max(1, page));
        req.setSize(Math.min(Math.max(1, size), 200));

        if (sort != null && !sort.isBlank()) {
            req.setSort(Arrays.asList(sort.split(",")));
        } else {
            req.setSort(Collections.emptyList());
        }

        Map<String, String> filters = new LinkedHashMap<>();
        for (var entry : params.entrySet()) {
            String key = entry.getKey();
            if (key == null || "page".equals(key) || "size".equals(key) || "sort".equals(key)) {
                continue;
            }
            filters.put(key, entry.getValue());
        }
        req.setFilters(filters);
        return req;
    }

    /** v1.0.2 Sprint 2 F1.4: 加载目标对象的所有 instance, 返回 [{id, label}] */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> loadTargetOptions(Long objectId, String displayField) {
        if (!LookupFieldExtractor.isValidIdentifier(displayField)) return List.of();
        AppObjectEntity object = objectRepository.findById(objectId).orElse(null);
        if (object == null) return List.of();
        String tableName = object.getDataTableName();
        if (tableName == null || tableName.isBlank()) return List.of();
        if (!LookupFieldExtractor.isValidIdentifier(tableName)) return List.of();

        String tenantId = TenantContext.required();

        String sql = "SELECT id, " + displayField + " AS label FROM " + tableName
                + " WHERE tenant_id = ? ORDER BY id LIMIT 500";
        List<Map<String, Object>> result = new ArrayList<>();
        try {
            result = dynamicTableService.getJdbcTemplate().query(sql,
                    new Object[]{tenantId},
                    (rs, idx) -> {
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("id", rs.getLong("id"));
                        Object labelObj = rs.getObject("label");
                        row.put("label", labelObj != null ? labelObj.toString() : "");
                        return row;
                    });
        } catch (Exception e) {
            return List.of();
        }
        return result;
    }
}
