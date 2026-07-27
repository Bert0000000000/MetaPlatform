package com.metaplatform.wfe.form.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.form.dto.*;
import com.metaplatform.wfe.form.service.FormDefinitionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = FormController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.wfe.security.SecurityConfig.class,
                        com.metaplatform.wfe.security.JwtAuthenticationFilter.class,
                        com.metaplatform.wfe.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
class FormControllerTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FormDefinitionService formDefinitionService;

    private FormDefinitionResponse buildResponse() {
        return FormDefinitionResponse.builder()
                .formId("form-1")
                .appId("app-1")
                .globalSettings(Map.of("title", "请假申请"))
                .linkageRules(List.of())
                .scripts(Map.of())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void saveSettings_returns_ok() throws Exception {
        when(formDefinitionService.saveSettings(eq("form-1"), any())).thenReturn(buildResponse());

        FormGlobalSettingsRequest request = new FormGlobalSettingsRequest();
        request.setTitle("请假申请");
        request.setTabMode("tab");

        mockMvc.perform(put("/api/v1/wfe/forms/form-1/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.formId").value("form-1"));
    }

    @Test
    void saveSettings_returns_400_when_title_blank() throws Exception {
        FormGlobalSettingsRequest request = new FormGlobalSettingsRequest();
        request.setTitle("");

        mockMvc.perform(put("/api/v1/wfe/forms/form-1/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validate_returns_result() throws Exception {
        when(formDefinitionService.validate(eq("form-1"), any()))
                .thenReturn(FormValidateResponse.builder()
                        .valid(true)
                        .errors(List.of())
                        .build());

        FormFieldMeta field = new FormFieldMeta();
        field.setId("f1");
        field.setType("text");
        field.setLabel("姓名");
        field.setFieldKey("name");
        FormValidateRequest request = new FormValidateRequest();
        request.setFields(List.of(field));

        mockMvc.perform(post("/api/v1/wfe/forms/form-1/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid").value(true));
    }
}
