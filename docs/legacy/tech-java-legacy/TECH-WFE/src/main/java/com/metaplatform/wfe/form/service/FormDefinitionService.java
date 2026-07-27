package com.metaplatform.wfe.form.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.form.dto.*;
import com.metaplatform.wfe.form.engine.LinkageRuleEngine;
import com.metaplatform.wfe.form.engine.ScriptSandbox;
import com.metaplatform.wfe.form.entity.FormDefinitionEntity;
import com.metaplatform.wfe.form.repository.FormDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * 表单定义服务（V13-13）：管理表单全局设置、联动规则、脚本与端到端校验。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FormDefinitionService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final FormDefinitionRepository formDefinitionRepository;
    private final LinkageRuleEngine linkageRuleEngine;
    private final ScriptSandbox scriptSandbox;

    @Transactional(readOnly = true)
    public FormDefinitionResponse get(String formId) {
        return toResponse(findById(formId));
    }

    @Transactional
    public FormDefinitionResponse saveSettings(String formId, FormGlobalSettingsRequest request) {
        FormDefinitionEntity entity = findOrCreate(formId);
        try {
            entity.setGlobalSettings(OBJECT_MAPPER.writeValueAsString(request));
        } catch (Exception e) {
            throw new WfeException(ErrorCode.INVALID_PARAM, "全局设置序列化失败: " + e.getMessage());
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(formDefinitionRepository.save(entity));
    }

    @Transactional
    public FormDefinitionResponse saveLinkageRules(String formId, FormLinkageRulesRequest request) {
        FormDefinitionEntity entity = findOrCreate(formId);
        try {
            entity.setLinkageRules(OBJECT_MAPPER.writeValueAsString(request.getRules()));
        } catch (Exception e) {
            throw new WfeException(ErrorCode.INVALID_PARAM, "联动规则序列化失败: " + e.getMessage());
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(formDefinitionRepository.save(entity));
    }

    @Transactional
    public FormDefinitionResponse saveScripts(String formId, FormScriptsRequest request) {
        FormDefinitionEntity entity = findOrCreate(formId);
        try {
            entity.setScripts(OBJECT_MAPPER.writeValueAsString(request));
        } catch (Exception e) {
            throw new WfeException(ErrorCode.INVALID_PARAM, "脚本序列化失败: " + e.getMessage());
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(formDefinitionRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public FormValidateResponse validate(String formId, FormValidateRequest request) {
        List<FormValidationError> errors = new ArrayList<>();

        // 1. 字段基础校验
        validateFields(request.getFields(), errors);

        // 2. 联动规则校验
        List<FormLinkageRule> rules = request.getLinkageRules();
        if (rules != null) {
            validateLinkageRules(rules, request.getFields(), errors);
        }

        // 3. 脚本语法校验（在受限沙箱中执行）
        Map<String, String> scripts = request.getScripts();
        if (scripts != null) {
            validateScript("beforeSubmit", scripts.get("beforeSubmit"), request.getValues(), errors);
            validateScript("afterSubmit", scripts.get("afterSubmit"), request.getValues(), errors);
            validateScript("onChange", scripts.get("onChange"), request.getValues(), errors);
        }

        // 4. 脚本与联动在样本值下的冲突检测
        if (scripts != null && request.getValues() != null) {
            detectConflicts(rules, scripts, request.getValues(), errors);
        }

        return FormValidateResponse.builder()
                .valid(errors.isEmpty())
                .errors(errors)
                .build();
    }

    private void validateFields(List<FormFieldMeta> fields, List<FormValidationError> errors) {
        if (fields == null || fields.isEmpty()) {
            errors.add(FormValidationError.builder()
                    .code("EMPTY_FIELDS")
                    .message("表单至少需要一个字段")
                    .build());
            return;
        }
        Set<String> keys = new HashSet<>();
        for (FormFieldMeta field : fields) {
            if (field.getFieldKey() == null || field.getFieldKey().isBlank()) {
                errors.add(FormValidationError.builder()
                        .fieldKey(field.getId())
                        .code("BLANK_FIELD_KEY")
                        .message("字段标识不能为空")
                        .build());
                continue;
            }
            if (!keys.add(field.getFieldKey())) {
                errors.add(FormValidationError.builder()
                        .fieldKey(field.getFieldKey())
                        .code("DUPLICATE_FIELD_KEY")
                        .message("字段标识重复: " + field.getFieldKey())
                        .build());
            }
        }
    }

    private void validateLinkageRules(List<FormLinkageRule> rules,
                                      List<FormFieldMeta> fields,
                                      List<FormValidationError> errors) {
        if (fields == null) return;
        Set<String> fieldKeys = fields.stream().map(FormFieldMeta::getFieldKey).collect(java.util.stream.Collectors.toSet());
        int idx = 0;
        for (FormLinkageRule rule : rules) {
            if (rule.getWhen() != null && !fieldKeys.contains(rule.getWhen().getFieldKey())) {
                errors.add(FormValidationError.builder()
                        .code("LINKAGE_UNKNOWN_FIELD")
                        .message("联动规则[" + idx + "]条件字段不存在: " + rule.getWhen().getFieldKey())
                        .build());
            }
            if (rule.getThen() != null && !fieldKeys.contains(rule.getThen().getFieldKey())) {
                errors.add(FormValidationError.builder()
                        .code("LINKAGE_UNKNOWN_FIELD")
                        .message("联动规则[" + idx + "]动作字段不存在: " + rule.getThen().getFieldKey())
                        .build());
            }
            idx++;
        }
    }

    private void validateScript(String name, String script,
                                Map<String, Object> values,
                                List<FormValidationError> errors) {
        if (script == null || script.isBlank()) return;
        List<FormValidationError> scriptErrors = scriptSandbox.validate(script, values);
        for (FormValidationError e : scriptErrors) {
            errors.add(FormValidationError.builder()
                    .fieldKey(e.getFieldKey() + "(" + name + ")")
                    .code(e.getCode())
                    .message("[" + name + "] " + e.getMessage())
                    .build());
        }
    }

    private void detectConflicts(List<FormLinkageRule> rules,
                                 Map<String, String> scripts,
                                 Map<String, Object> values,
                                 List<FormValidationError> errors) {
        LinkageRuleEngine.LinkageResult linkageResult = linkageRuleEngine.evaluate(rules, values);

        String onChange = scripts.get("onChange");
        if (onChange != null && !onChange.isBlank()) {
            ScriptSandbox.ScriptResult scriptResult = scriptSandbox.execute(onChange, values, List.of());
            linkageResult.required.keySet().stream()
                    .filter(scriptResult.getFieldRequired()::containsKey)
                    .forEach(key -> errors.add(FormValidationError.builder()
                            .fieldKey(key)
                            .code("CONFLICT_REQUIRED")
                            .message("字段 " + key + " 同时被联动规则和 onChange 脚本设置必填")
                            .build()));
            linkageResult.visible.keySet().stream()
                    .filter(scriptResult.getFieldVisible()::containsKey)
                    .forEach(key -> errors.add(FormValidationError.builder()
                            .fieldKey(key)
                            .code("CONFLICT_VISIBLE")
                            .message("字段 " + key + " 同时被联动规则和 onChange 脚本设置显隐")
                            .build()));
        }
    }

    private FormDefinitionEntity findById(String formId) {
        return formDefinitionRepository.findByIdAndTenantId(formId, TenantContext.get())
                .orElseThrow(() -> new WfeException(ErrorCode.FORM_DEFINITION_NOT_FOUND,
                        "表单定义不存在: " + formId));
    }

    private FormDefinitionEntity findOrCreate(String formId) {
        return formDefinitionRepository.findByIdAndTenantId(formId, TenantContext.get())
                .orElseGet(() -> FormDefinitionEntity.builder()
                        .id(formId)
                        .tenantId(TenantContext.get())
                        .globalSettings("{}")
                        .linkageRules("[]")
                        .scripts("{}")
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build());
    }

    private FormDefinitionResponse toResponse(FormDefinitionEntity entity) {
        return FormDefinitionResponse.builder()
                .formId(entity.getId())
                .appId(entity.getAppId())
                .globalSettings(readJson(entity.getGlobalSettings()))
                .linkageRules(readJsonList(entity.getLinkageRules()))
                .scripts(readJson(entity.getScripts()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private Object readJson(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse form json: {}", e.getMessage());
            return Map.of();
        }
    }

    private Object readJsonList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<List<Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse form json array: {}", e.getMessage());
            return List.of();
        }
    }
}
