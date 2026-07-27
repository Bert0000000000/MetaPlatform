package com.metaplatform.obs.dashboard.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.metaplatform.obs.common.TraceFilter;
import com.metaplatform.obs.dashboard.dto.DashboardExport;
import com.metaplatform.obs.dashboard.entity.DashboardEntity;
import com.metaplatform.obs.dashboard.service.DashboardService;
import com.metaplatform.obs.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = DashboardController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DashboardService dashboardService;

    @Test
    void create_shouldReturnDashboard() throws Exception {
        DashboardEntity entity = DashboardEntity.builder()
                .id(UUID.randomUUID()).title("Overview").isPublic(false)
                .layout(JsonNodeFactory.instance.arrayNode())
                .panels(JsonNodeFactory.instance.arrayNode())
                .build();
        when(dashboardService.create(any())).thenReturn(entity);

        String body = """
                {"title":"Overview","layout":[],"panels":[],"isPublic":false}
                """;

        mockMvc.perform(post("/api/v1/obs/dashboards")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.title").value("Overview"));
    }

    @Test
    void share_shouldGenerateShareToken() throws Exception {
        UUID id = UUID.randomUUID();
        DashboardEntity shared = DashboardEntity.builder()
                .id(id).title("X").isPublic(true).shareToken("abc-token").build();
        when(dashboardService.generateShareToken(eq(id))).thenReturn(shared);

        mockMvc.perform(post("/api/v1/obs/dashboards/" + id + "/share"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.shareToken").value("abc-token"))
                .andExpect(jsonPath("$.data.public").value(true));
    }

    @Test
    void getShared_shouldReturnDashboard() throws Exception {
        DashboardEntity shared = DashboardEntity.builder()
                .id(UUID.randomUUID()).title("X").shareToken("tok").isPublic(true)
                .layout(JsonNodeFactory.instance.arrayNode())
                .panels(JsonNodeFactory.instance.arrayNode())
                .build();
        when(dashboardService.getByShareToken(eq("tok"))).thenReturn(shared);

        mockMvc.perform(get("/api/v1/obs/dashboards/shared/tok"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("X"))
                .andExpect(jsonPath("$.data.shareToken").value("tok"));
    }

    @Test
    void list_shouldReturnDashboards() throws Exception {
        when(dashboardService.list()).thenReturn(List.of(
                DashboardEntity.builder().id(UUID.randomUUID()).title("A").build(),
                DashboardEntity.builder().id(UUID.randomUUID()).title("B").build()));

        mockMvc.perform(get("/api/v1/obs/dashboards"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].title").value("A"));
    }

    @Test
    void update_shouldReturnUpdatedDashboard() throws Exception {
        UUID id = UUID.randomUUID();
        DashboardEntity updated = DashboardEntity.builder()
                .id(id).title("Updated").isPublic(true).build();
        when(dashboardService.update(eq(id), any())).thenReturn(updated);

        String body = """
                {"title":"Updated","isPublic":true,"layout":[],"panels":[]}
                """;

        mockMvc.perform(put("/api/v1/obs/dashboards/" + id)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Updated"))
                .andExpect(jsonPath("$.data.public").value(true));
    }

    @Test
    void delete_shouldReturnSuccess() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/obs/dashboards/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void export_shouldReturnJsonAttachment() throws Exception {
        UUID id = UUID.randomUUID();
        DashboardExport export = DashboardExport.builder()
                .id(id).title("Overview")
                .layout(JsonNodeFactory.instance.arrayNode())
                .panels(JsonNodeFactory.instance.arrayNode())
                .build();
        when(dashboardService.export(eq(id))).thenReturn(export);

        mockMvc.perform(get("/api/v1/obs/dashboards/" + id + "/export"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("dashboard-" + id + ".json")))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }
}