package com.metaplatform.base.interfaces.rest;

import com.metaplatform.base.config.TenantInterceptor;
import com.metaplatform.base.tenant.Tenant;
import com.metaplatform.base.tenant.TenantId;
import com.metaplatform.base.tenant.TenantService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TenantController.class)
class TenantControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TenantService tenantService;

    @MockBean
    private TenantInterceptor tenantInterceptor;

    @Test
    void shouldCreateTenant() throws Exception {
        TenantId id = TenantId.newId();
        Tenant tenant = new Tenant(id, "Acme", "acme", true);
        when(tenantService.create("Acme", "acme")).thenReturn(tenant);

        mockMvc.perform(post("/api/v1/tenants")
                        .contentType("application/json")
                        .content("{\"name\":\"Acme\",\"slug\":\"acme\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Acme"))
                .andExpect(jsonPath("$.slug").value("acme"));
    }

    @Test
    void shouldListTenants() throws Exception {
        Tenant t1 = new Tenant(TenantId.newId(), "Acme", "acme", true);
        Tenant t2 = new Tenant(TenantId.newId(), "Beta", "beta", true);
        when(tenantService.findAll()).thenReturn(List.of(t1, t2));

        mockMvc.perform(get("/api/v1/tenants"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }
}
