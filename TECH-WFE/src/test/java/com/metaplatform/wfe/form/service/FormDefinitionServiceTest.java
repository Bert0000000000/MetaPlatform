package com.metaplatform.wfe.form.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.form.dto.*;
import com.metaplatform.wfe.form.engine.LinkageRuleEngine;
import com.metaplatform.wfe.form.engine.ScriptSandbox;
import com.metaplatform.wfe.form.entity.FormDefinitionEntity;
import com.metaplatform.wfe.form.repository.FormDefinitionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FormDefinitionServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Mock private FormDefinitionRepository formDefinitionRepository;
    @Spy private LinkageRuleEngine linkageRuleEngine = new LinkageRuleEngine();
    @Spy private ScriptSandbox scriptSandbox = new ScriptSandbox();

    @InjectMocks
    private FormDefinitionService formDefinitionService;

    @BeforeEach
    void setUp() {
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private FormDefinitionEntity buildEntity(String id) {
        return FormDefinitionEntity.builder()
                .id(id)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .appId("app-001")
                .globalSettings("{\"title\":\"请假申请\",\"tabMode\":\"tab\"}")
                .linkageRules("[]")
                .scripts("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void get_returns_definition_when_found() {
        when(formDefinitionRepository.findByIdAndTenantId("form-1", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(buildEntity("form-1")));

        FormDefinitionResponse response = formDefinitionService.get("form-1");

        assertThat(response.getFormId()).isEqualTo("form-1");
        assertThat(response.getGlobalSettings()).isInstanceOf(Map.class);
    }

    @Test
    void get_throws_404_when_not_found() {
        when(formDefinitionRepository.findByIdAndTenantId("missing", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> formDefinitionService.get("missing"))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.FORM_DEFINITION_NOT_FOUND);
    }

    @Test
    void saveSettings_creates_entity_when_not_exists() throws Exception {
        FormGlobalSettingsRequest request = new FormGlobalSettingsRequest();
        request.setTitle("报销申请");
        request.setTabMode("step");
        request.setLayoutDensity("compact");
        when(formDefinitionRepository.findByIdAndTenantId("form-1", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.empty());
        when(formDefinitionRepository.save(any(FormDefinitionEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        FormDefinitionResponse response = formDefinitionService.saveSettings("form-1", request);

        Map<?, ?> settings = (Map<?, ?>) response.getGlobalSettings();
        assertThat(settings.get("title")).isEqualTo("报销申请");
        assertThat(settings.get("tabMode")).isEqualTo("step");
    }

    @Test
    void saveLinkageRules_persists_rules() {
        FormLinkageRule rule = new FormLinkageRule();
        FormLinkageRule.WhenCondition when = new FormLinkageRule.WhenCondition();
        when.setFieldKey("type");
        when.setOperator("eq");
        when.setValue("urgent");
        FormLinkageRule.ThenAction then = new FormLinkageRule.ThenAction();
        then.setFieldKey("manager");
        then.setAction("require");
        rule.setWhen(when);
        rule.setThen(then);

        FormLinkageRulesRequest request = new FormLinkageRulesRequest();
        request.setRules(List.of(rule));

        when(formDefinitionRepository.findByIdAndTenantId("form-1", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(buildEntity("form-1")));
        when(formDefinitionRepository.save(any(FormDefinitionEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        FormDefinitionResponse response = formDefinitionService.saveLinkageRules("form-1", request);

        List<?> rules = (List<?>) response.getLinkageRules();
        assertThat(rules).hasSize(1);
    }

    @Test
    void validate_returns_valid_for_good_form() {
        FormFieldMeta field = new FormFieldMeta();
        field.setId("f1");
        field.setType("text");
        field.setLabel("姓名");
        field.setFieldKey("name");

        FormValidateRequest request = new FormValidateRequest();
        request.setFields(List.of(field));
        request.setValues(Map.of("name", "Alice"));

        FormValidateResponse response = formDefinitionService.validate("form-1", request);

        assertThat(response.isValid()).isTrue();
        assertThat(response.getErrors()).isEmpty();
    }

    @Test
    void validate_detects_duplicate_field_keys() {
        FormFieldMeta f1 = new FormFieldMeta();
        f1.setId("f1");
        f1.setType("text");
        f1.setLabel("A");
        f1.setFieldKey("same");
        FormFieldMeta f2 = new FormFieldMeta();
        f2.setId("f2");
        f2.setType("text");
        f2.setLabel("B");
        f2.setFieldKey("same");

        FormValidateRequest request = new FormValidateRequest();
        request.setFields(List.of(f1, f2));

        FormValidateResponse response = formDefinitionService.validate("form-1", request);

        assertThat(response.isValid()).isFalse();
        assertThat(response.getErrors())
                .extracting(FormValidationError::getCode)
                .contains("DUPLICATE_FIELD_KEY");
    }

    @Test
    void validate_detects_script_error() {
        FormFieldMeta field = new FormFieldMeta();
        field.setId("f1");
        field.setType("text");
        field.setLabel("姓名");
        field.setFieldKey("name");

        FormValidateRequest request = new FormValidateRequest();
        request.setFields(List.of(field));
        request.setScripts(Map.of("beforeSubmit", "if (values.name == \"bad\" { form.addError('name', 'err'); }"));

        FormValidateResponse response = formDefinitionService.validate("form-1", request);

        assertThat(response.isValid()).isFalse();
        assertThat(response.getErrors())
                .extracting(FormValidationError::getCode)
                .contains("SCRIPT_ERROR");
    }

    @Test
    void validate_detects_linkage_unknown_field() {
        FormFieldMeta field = new FormFieldMeta();
        field.setId("f1");
        field.setType("text");
        field.setLabel("姓名");
        field.setFieldKey("name");

        FormLinkageRule rule = new FormLinkageRule();
        FormLinkageRule.WhenCondition when = new FormLinkageRule.WhenCondition();
        when.setFieldKey("unknown");
        when.setOperator("eq");
        when.setValue("x");
        FormLinkageRule.ThenAction then = new FormLinkageRule.ThenAction();
        then.setFieldKey("name");
        then.setAction("require");
        rule.setWhen(when);
        rule.setThen(then);

        FormValidateRequest request = new FormValidateRequest();
        request.setFields(List.of(field));
        request.setLinkageRules(List.of(rule));

        FormValidateResponse response = formDefinitionService.validate("form-1", request);

        assertThat(response.isValid()).isFalse();
        assertThat(response.getErrors())
                .extracting(FormValidationError::getCode)
                .contains("LINKAGE_UNKNOWN_FIELD");
    }
}
