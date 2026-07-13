package com.metaplatform.appservice.domain.form;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.app.AppRepository;
import com.metaplatform.appservice.domain.dynamic.DynamicTableService;
import com.metaplatform.appservice.domain.object.AppObjectEntity;
import com.metaplatform.appservice.domain.object.AppObjectRepository;
import com.metaplatform.appservice.domain.workflow.AppFormWorkflowService;
import com.metaplatform.appservice.domain.workflow.AppWorkflowDefinitionEntity;
import com.metaplatform.appservice.domain.workflow.AppWorkflowDefinitionService;
import com.metaplatform.appservice.domain.workflow.FlowableRestClient;
import com.metaplatform.appservice.security.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 表单公开提交服务：校验、写入动态数据表、记录提交记录、触发流程实例。
 */
@Service
public class FormSubmissionService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final AppFormRepository formRepository;
    private final AppObjectRepository objectRepository;
    private final AppRepository appRepository;
    private final DynamicTableService dynamicTableService;
    private final FormSubmissionRepository submissionRepository;
    private final AppWorkflowDefinitionService workflowDefinitionService;
    private final AppFormWorkflowService formWorkflowService;
    private final FlowableRestClient flowableRestClient;

    public FormSubmissionService(AppFormRepository formRepository,
                                 AppObjectRepository objectRepository,
                                 AppRepository appRepository,
                                 DynamicTableService dynamicTableService,
                                 FormSubmissionRepository submissionRepository,
                                 AppWorkflowDefinitionService workflowDefinitionService,
                                 AppFormWorkflowService formWorkflowService,
                                 FlowableRestClient flowableRestClient) {
        this.formRepository = formRepository;
        this.objectRepository = objectRepository;
        this.appRepository = appRepository;
        this.dynamicTableService = dynamicTableService;
        this.submissionRepository = submissionRepository;
        this.workflowDefinitionService = workflowDefinitionService;
        this.formWorkflowService = formWorkflowService;
        this.flowableRestClient = flowableRestClient;
    }

    /**
     * 提交表单。返回 form_submissions.id。
     *
     * <p>步骤：
     * 1. 校验表单、对象、字段。
     * 2. 先创建 submission 记录（获取 id）。
     * 3. 写入动态表，得到 row_id。
     * 4. 更新 submission.row_id。
     * 5. 若表单绑定已发布流程，启动 Flowable 流程实例并更新状态。
     */
    @Transactional
    public Long submit(Long formId, Map<String, Object> values) {
        AppFormEntity form = formRepository.findById(formId)
                .orElseThrow(() -> ApiException.notFound("表单不存在"));
        if (!"published".equals(form.getStatus())) {
            throw ApiException.badRequest("表单未发布，不可提交");
        }

        AppObjectEntity object = objectRepository.findById(form.getObjectId())
                .orElseThrow(() -> ApiException.notFound("表单绑定的对象不存在"));

        String tableName = object.getDataTableName();
        if (tableName == null || tableName.isBlank()) {
            throw ApiException.internalError("对象尚未创建物理数据表");
        }

        List<ObjectField> objectFields = parseObjectFields(object.getSchemaJson());
        List<FormField> formFields = parseFormFields(form.getSchemaJson());

        Map<String, Object> row = new HashMap<>();
        for (FormField ff : formFields) {
            String key = ff.key();
            Object rawValue = values.get(key);
            ObjectField of = findObjectField(objectFields, ff.boundProperty(), key);
            Object converted = validateAndConvert(ff, of, rawValue, tableName);
            if (converted != null) {
                row.put(key, converted);
            }
        }

        String tenantId = resolveTenantId(form.getAppId());

        // 1. 先创建 submission 占位
        FormSubmissionEntity submission = new FormSubmissionEntity();
        submission.setAppId(form.getAppId());
        submission.setFormId(formId);
        submission.setObjectId(form.getObjectId());
        submission.setRowId(-1L); // 占位
        submission.setValuesJson(toJson(values));
        submission.setTenantId(tenantId);
        submission.setSubmitterId("public-form");
        submission.setWorkflowStatus("none");
        submission = submissionRepository.save(submission);

        // 2. 写入动态表
        Long rowId = dynamicTableService.insertRow(tableName, row, tenantId, "public-form");
        submission.setRowId(rowId);
        submission = submissionRepository.save(submission);

        // 3. 若绑定流程，启动实例
        var binding = formWorkflowService.findEnabled(String.valueOf(form.getAppId()), formId);
        if (binding.isPresent()) {
            var defOpt = workflowDefinitionService.getById(String.valueOf(form.getAppId()), binding.get().getWorkflowDefinitionId());
            if ("published".equals(defOpt.getStatus()) && defOpt.getProcessDefinitionId() != null) {
                startWorkflow(submission, defOpt, values, tenantId);
            }
        }

        return submission.getId();
    }

    private void startWorkflow(FormSubmissionEntity submission, AppWorkflowDefinitionEntity def,
                               Map<String, Object> values, String tenantId) {
        try {
            Map<String, Object> variables = new HashMap<>(values);
            variables.put("submissionId", submission.getId());
            variables.put("formId", submission.getFormId());
            variables.put("appId", submission.getAppId());
            variables.put("tenantId", tenantId);
            variables.put("starterId", submission.getSubmitterId());
            variables.put("approved", true);

            var instance = flowableRestClient.startProcessInstance(
                    def.getProcessDefinitionId(),
                    "submission:" + submission.getId(),
                    variables
            );
            String instanceId = instance.path("id").asText();
            submission.setProcessInstanceId(instanceId);
            submission.setWorkflowStatus("running");

            // 查询当前任务
            var tasks = flowableRestClient.listTasks(Map.of("processInstanceId", instanceId));
            if (!tasks.isEmpty()) {
                JsonNode task = tasks.get(0);
                submission.setCurrentTaskId(task.path("id").asText());
                submission.setCurrentTaskName(task.path("name").asText());
            }
            submissionRepository.save(submission);
        } catch (Exception e) {
            // 流程启动失败不影响表单提交成功；记录状态为 error，便于排查。
            submission.setWorkflowStatus("error");
            submissionRepository.save(submission);
            // 不抛出，保证表单提交原子性已成功。
        }
    }

    private String resolveTenantId(Long appId) {
        String current = TenantContext.get();
        if (current != null && !current.isBlank()) {
            return current;
        }
        return appRepository.findById(appId)
                .map(a -> a.getTenantId())
                .orElse("default-tenant");
    }

    private String toJson(Object obj) {
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (Exception e) {
            throw ApiException.internalError("序列化表单值失败");
        }
    }

    private List<ObjectField> parseObjectFields(String schemaJson) {
        List<ObjectField> result = new ArrayList<>();
        if (schemaJson == null || schemaJson.isBlank()) return result;
        try {
            JsonNode arr = MAPPER.readTree(schemaJson);
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    result.add(new ObjectField(
                            text(n, "code"),
                            text(n, "name"),
                            text(n, "type"),
                            bool(n, "required"),
                            bool(n, "unique")
                    ));
                }
            }
        } catch (Exception e) {
            throw ApiException.internalError("对象字段 schema 解析失败: " + e.getMessage());
        }
        return result;
    }

    private List<FormField> parseFormFields(String schemaJson) {
        List<FormField> result = new ArrayList<>();
        if (schemaJson == null || schemaJson.isBlank()) return result;
        try {
            JsonNode root = MAPPER.readTree(schemaJson);
            JsonNode sections = root.path("sections");
            if (sections.isArray()) {
                for (JsonNode section : sections) {
                    JsonNode fields = section.path("fields");
                    if (fields.isArray()) {
                        for (JsonNode f : fields) {
                            String key = firstText(f, List.of("fieldKey", "key", "field", "id"));
                            if (key == null || key.isBlank()) continue;
                            result.add(new FormField(
                                    key,
                                    text(f, "label"),
                                    text(f, "widget"),
                                    bool(f, "required"),
                                    firstText(f, List.of("boundProperty", "boundObject")),
                                    text(f, "placeholder")
                            ));
                        }
                    }
                }
            }
        } catch (Exception e) {
            throw ApiException.internalError("表单 schema 解析失败: " + e.getMessage());
        }
        return result;
    }

    private ObjectField findObjectField(List<ObjectField> objectFields, String boundProperty, String key) {
        if (boundProperty != null && !boundProperty.isBlank()) {
            for (ObjectField of : objectFields) {
                if (of.code().equals(boundProperty)) return of;
            }
        }
        for (ObjectField of : objectFields) {
            if (of.code().equals(key)) return of;
        }
        return null;
    }

    private Object validateAndConvert(FormField ff, ObjectField of, Object rawValue, String tableName) {
        String label = (ff.label() != null && !ff.label().isBlank()) ? ff.label() : ff.key();

        // 必填校验
        if (Boolean.TRUE.equals(ff.required())) {
            if (rawValue == null || (rawValue instanceof String s && s.isBlank())) {
                throw ApiException.badRequest("字段 " + label + " 不能为空");
            }
        }

        if (rawValue == null) return null;
        if (rawValue instanceof String s && s.isBlank() && !Boolean.TRUE.equals(ff.required())) {
            return null;
        }

        String type = (of != null) ? of.type() : null;
        Object converted = convertValue(rawValue, type);

        // 唯一校验
        if (of != null && Boolean.TRUE.equals(of.unique())) {
            if (dynamicTableService.exists(tableName, ff.key(), converted, TenantContext.required())) {
                throw ApiException.badRequest("字段 " + label + " 的值已存在，不可重复");
            }
        }

        return converted;
    }

    private Object convertValue(Object rawValue, String type) {
        if (rawValue == null) return null;
        String t = type != null ? type : "text";
        String s = rawValue.toString().trim();
        if (s.isEmpty()) return null;

        return switch (t) {
            case "number" -> {
                try {
                    yield Double.parseDouble(s);
                } catch (NumberFormatException e) {
                    throw ApiException.badRequest("字段值必须是数字: " + s);
                }
            }
            case "boolean" -> {
                yield Boolean.parseBoolean(s) || "1".equals(s) || "是".equals(s) || "yes".equalsIgnoreCase(s);
            }
            case "date" -> {
                try {
                    yield LocalDate.parse(s);
                } catch (Exception e) {
                    throw ApiException.badRequest("日期格式不正确: " + s);
                }
            }
            case "datetime" -> {
                try {
                    yield LocalDateTime.parse(s);
                } catch (Exception e) {
                    throw ApiException.badRequest("日期时间格式不正确: " + s);
                }
            }
            default -> s;
        };
    }

    private static String text(JsonNode node, String field) {
        JsonNode n = node.path(field);
        return n.isMissingNode() || n.isNull() ? null : n.asText();
    }

    private static String firstText(JsonNode node, List<String> fields) {
        for (String f : fields) {
            String v = text(node, f);
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static Boolean bool(JsonNode node, String field) {
        JsonNode n = node.path(field);
        if (n.isMissingNode() || n.isNull()) return false;
        return n.asBoolean(false);
    }

    @Transactional(readOnly = true)
    public List<FormSubmissionEntity> listByFormId(Long formId) {
        return submissionRepository.findByFormId(formId);
    }

    private record ObjectField(String code, String name, String type, Boolean required, Boolean unique) {}
    private record FormField(String key, String label, String widget, Boolean required,
                             String boundProperty, String placeholder) {}
}
