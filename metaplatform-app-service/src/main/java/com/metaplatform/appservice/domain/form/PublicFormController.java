package com.metaplatform.appservice.domain.form;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.api.error.ApiResponse;
import com.metaplatform.appservice.domain.app.AppRepository;
import com.metaplatform.appservice.security.TenantContext;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
    private final FormSubmissionService submissionService;

    public PublicFormController(AppFormRepository formRepository,
                                AppRepository appRepository,
                                FormSubmissionService submissionService) {
        this.formRepository = formRepository;
        this.appRepository = appRepository;
        this.submissionService = submissionService;
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
}
