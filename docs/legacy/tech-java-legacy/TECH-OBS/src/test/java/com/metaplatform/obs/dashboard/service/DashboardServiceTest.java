package com.metaplatform.obs.dashboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.dashboard.dto.DashboardExport;
import com.metaplatform.obs.dashboard.dto.DashboardRequest;
import com.metaplatform.obs.dashboard.entity.DashboardEntity;
import com.metaplatform.obs.dashboard.repository.DashboardRepository;
import com.metaplatform.obs.exception.ObsException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock
    private DashboardRepository dashboardRepository;

    private DashboardService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        service = new DashboardService(dashboardRepository, objectMapper);
        TenantContext.set("tenant-test");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("create 缺 title 应抛错")
    void shouldRejectMissingTitle() {
        DashboardRequest req = DashboardRequest.builder().build();
        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("create 应写入并填充 layout/panels JSON")
    void shouldCreateDashboard() {
        ObjectNode layout = JsonNodeFactory.instance.objectNode();
        ObjectNode panels = JsonNodeFactory.instance.objectNode();
        DashboardRequest req = DashboardRequest.builder()
                .title("Overview").description("daily")
                .layout(layout).panels(panels).isPublic(false).build();

        when(dashboardRepository.insert(any(DashboardEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(dashboardRepository.getLayoutJson(any())).thenReturn(layout.toString());
        when(dashboardRepository.getPanelsJson(any())).thenReturn(panels.toString());

        DashboardEntity saved = service.create(req);
        assertThat(saved.getTitle()).isEqualTo("Overview");
        assertThat(saved.isPublic()).isFalse();
        assertThat(saved.getTenantId()).isEqualTo("tenant-test");
    }

    @Test
    @DisplayName("update 不存在应抛错")
    void shouldRejectMissingDashboardOnUpdate() {
        when(dashboardRepository.findById(any(UUID.class))).thenReturn(Optional.empty());
        DashboardRequest req = DashboardRequest.builder().title("X").build();
        assertThatThrownBy(() -> service.update(UUID.randomUUID(), req))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("generateShareToken 应产生随机 token 并设为 public")
    void shouldGenerateShareToken() {
        UUID id = UUID.randomUUID();
        DashboardEntity existing = DashboardEntity.builder()
                .id(id).tenantId("tenant-test").title("X").isPublic(false).build();
        when(dashboardRepository.findById(id)).thenReturn(Optional.of(existing));
        when(dashboardRepository.update(any(DashboardEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(dashboardRepository.getLayoutJson(any())).thenReturn(null);
        when(dashboardRepository.getPanelsJson(any())).thenReturn(null);

        DashboardEntity shared = service.generateShareToken(id);
        assertThat(shared.getShareToken()).isNotBlank();
        assertThat(shared.getShareToken().length()).isGreaterThan(20);
        assertThat(shared.isPublic()).isTrue();
    }

    @Test
    @DisplayName("generateShareToken 应生成唯一 token")
    void shouldGenerateUniqueTokens() {
        DashboardEntity existing = DashboardEntity.builder()
                .id(UUID.randomUUID()).tenantId("tenant-test").title("X").build();
        when(dashboardRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(dashboardRepository.update(any(DashboardEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(dashboardRepository.getLayoutJson(any())).thenReturn(null);
        when(dashboardRepository.getPanelsJson(any())).thenReturn(null);

        String token1 = service.generateShareToken(existing.getId()).getShareToken();
        String token2 = service.generateShareToken(existing.getId()).getShareToken();
        assertThat(token1).isNotEqualTo(token2);
    }

    @Test
    @DisplayName("export 应返回含 layout/panels 的快照")
    void shouldExportDashboard() {
        UUID id = UUID.randomUUID();
        DashboardEntity existing = DashboardEntity.builder()
                .id(id).tenantId("tenant-test").title("Overview").description("d").build();
        when(dashboardRepository.findById(id)).thenReturn(Optional.of(existing));
        when(dashboardRepository.getLayoutJson(id)).thenReturn("[]");
        when(dashboardRepository.getPanelsJson(id)).thenReturn("[]");

        DashboardExport export = service.export(id);
        assertThat(export.getId()).isEqualTo(id);
        assertThat(export.getTitle()).isEqualTo("Overview");
        assertThat(export.getExportedAt()).isNotNull();
    }

    @Test
    @DisplayName("getByShareToken 无效应抛错")
    void shouldRejectInvalidShareToken() {
        when(dashboardRepository.findByShareToken("bad")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getByShareToken("bad"))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("list 应返回当前租户的仪表盘")
    void shouldListDashboards() {
        when(dashboardRepository.findAll("tenant-test")).thenReturn(List.of(
                DashboardEntity.builder().id(UUID.randomUUID()).title("A").build(),
                DashboardEntity.builder().id(UUID.randomUUID()).title("B").build()));
        when(dashboardRepository.getLayoutJson(any())).thenReturn(null);
        when(dashboardRepository.getPanelsJson(any())).thenReturn(null);

        List<DashboardEntity> list = service.list();
        assertThat(list).hasSize(2);
    }
}