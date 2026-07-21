package com.metaplatform.iam.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.dto.policy.ConditionSyntaxResponse;
import com.metaplatform.iam.dto.policy.CreatePolicyRequest;
import com.metaplatform.iam.dto.policy.PolicyMatrixResponse;
import com.metaplatform.iam.dto.policy.PolicyResponse;
import com.metaplatform.iam.dto.policy.UpdatePolicyRequest;
import com.metaplatform.iam.entity.PolicyEntity;
import com.metaplatform.iam.service.PolicyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = PolicyController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.iam.security.SecurityConfig.class,
                           com.metaplatform.iam.security.JwtAuthenticationFilter.class,
                           com.metaplatform.iam.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
class PolicyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PolicyService policyService;

    @Test
    void createPolicy_shouldReturn200() throws Exception {
        CreatePolicyRequest request = new CreatePolicyRequest();
        request.setName("允许调用");
        request.setSubjectType(PolicyEntity.SubjectType.USER);
        request.setSubjectId("u1");
        request.setResourceType("tool");
        request.setResourceIds(List.of("t1"));
        request.setAction("invoke");
        request.setEffect(PolicyEntity.Effect.ALLOW);
        request.setPriority(10);
        request.setEnabled(true);

        PolicyResponse response = PolicyResponse.builder()
                .id("p1").name("允许调用").subjectType(PolicyEntity.SubjectType.USER)
                .subjectId("u1").resourceType("tool").resourceIds(List.of("t1"))
                .action("invoke").effect(PolicyEntity.Effect.ALLOW)
                .priority(10).enabled(true).version(1).build();
        when(policyService.create(any(CreatePolicyRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/iam/policies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("允许调用"))
                .andExpect(jsonPath("$.data.effect").value("ALLOW"));
    }

    @Test
    void createPolicy_shouldReturn400_whenMissingRequired() throws Exception {
        CreatePolicyRequest request = new CreatePolicyRequest();
        request.setName("缺少主体");

        mockMvc.perform(post("/api/v1/iam/policies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getPolicy_shouldReturn200() throws Exception {
        when(policyService.get("p1")).thenReturn(PolicyResponse.builder()
                .id("p1").name("策略").subjectType(PolicyEntity.SubjectType.APP)
                .subjectId("app1").resourceType("tool").resourceIds(List.of("t1"))
                .action("invoke").effect(PolicyEntity.Effect.DENY).build());

        mockMvc.perform(get("/api/v1/iam/policies/p1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("p1"));
    }

    @Test
    void updatePolicy_shouldReturn200() throws Exception {
        UpdatePolicyRequest request = new UpdatePolicyRequest();
        request.setName("允许调用");
        request.setSubjectType(PolicyEntity.SubjectType.USER);
        request.setSubjectId("u1");
        request.setResourceType("tool");
        request.setResourceIds(List.of("t1"));
        request.setAction("invoke");
        request.setEffect(PolicyEntity.Effect.ALLOW);
        request.setPriority(10);
        request.setEnabled(true);
        request.setVersion(1);

        when(policyService.update(any(), any())).thenReturn(PolicyResponse.builder()
                .id("p1").name("允许调用").subjectType(PolicyEntity.SubjectType.USER)
                .subjectId("u1").resourceType("tool").resourceIds(List.of("t1"))
                .action("invoke").effect(PolicyEntity.Effect.ALLOW)
                .priority(10).enabled(true).version(2).build());

        mockMvc.perform(put("/api/v1/iam/policies/p1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2));
    }

    @Test
    void deletePolicy_shouldReturn200() throws Exception {
        mockMvc.perform(delete("/api/v1/iam/policies/p1"))
                .andExpect(status().isOk());
    }

    @Test
    void matrix_shouldReturn200() throws Exception {
        when(policyService.buildMatrix("user-tool", null)).thenReturn(
                PolicyMatrixResponse.builder()
                        .type("user-tool")
                        .action("invoke")
                        .rows(List.of())
                        .columns(List.of())
                        .build());

        mockMvc.perform(get("/api/v1/iam/policies/matrix?type=user-tool"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("user-tool"));
    }

    @Test
    void conditionSyntax_shouldReturn200() throws Exception {
        when(policyService.conditionSyntax()).thenReturn(ConditionSyntaxResponse.builder()
                .syntax("SpEL-like")
                .description("desc")
                .examples(List.of("example"))
                .variables(List.of("env"))
                .build());

        mockMvc.perform(get("/api/v1/iam/policies/condition-syntax"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.examples").exists());
    }
}
