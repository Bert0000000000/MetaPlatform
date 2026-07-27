package com.metaplatform.wfe.apphub.service;

import com.metaplatform.wfe.apphub.dto.AppVersionCreateRequest;
import com.metaplatform.wfe.apphub.dto.AppVersionResponse;
import com.metaplatform.wfe.apphub.entity.AppVersionEntity;
import com.metaplatform.wfe.apphub.entity.AppVersionStatus;
import com.metaplatform.wfe.apphub.repository.AppVersionRepository;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.service.WfeOutboxService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AppVersionServiceTest {

    @Mock private AppVersionRepository appVersionRepository;
    @Mock private WfeOutboxService wfeOutboxService;

    @InjectMocks private AppVersionService appVersionService;

    @BeforeEach
    void setUp() {
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private AppVersionEntity buildEntity(String id, String appId, String version, AppVersionStatus status) {
        return AppVersionEntity.builder()
                .id(id)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .appId(appId)
                .version(version)
                .snapshot("{\"k\":\"v\"}")
                .status(status)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void create_persists_and_publishes_event() {
        AppVersionCreateRequest request = new AppVersionCreateRequest();
        request.setAppId("app-001");
        request.setVersion("v1");
        request.setSnapshot("{\"k\":\"v\"}");
        when(appVersionRepository.existsByTenantIdAndAppIdAndVersion(
                TenantContext.DEFAULT_TENANT_ID, "app-001", "v1")).thenReturn(false);
        when(appVersionRepository.save(any(AppVersionEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        AppVersionResponse response = appVersionService.create(request);

        assertThat(response.getAppId()).isEqualTo("app-001");
        assertThat(response.getVersion()).isEqualTo("v1");
        assertThat(response.getStatus()).isEqualTo("DRAFT");
        verify(appVersionRepository).save(any(AppVersionEntity.class));
        verify(wfeOutboxService).publishEvent(
                eq(TenantContext.DEFAULT_TENANT_ID), anyString(), eq("APP_VERSION_CREATED"), any(), any());
    }

    @Test
    void create_throws_409_when_version_duplicate() {
        AppVersionCreateRequest request = new AppVersionCreateRequest();
        request.setAppId("app-001");
        request.setVersion("v1");
        request.setSnapshot("{}");
        when(appVersionRepository.existsByTenantIdAndAppIdAndVersion(
                TenantContext.DEFAULT_TENANT_ID, "app-001", "v1")).thenReturn(true);

        assertThatThrownBy(() -> appVersionService.create(request))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.APP_VERSION_STATUS_CONFLICT);
        verify(appVersionRepository, never()).save(any());
    }

    @Test
    void list_returns_page_response() {
        AppVersionEntity e1 = buildEntity("v-1", "app-001", "v1", AppVersionStatus.PUBLISHED);
        AppVersionEntity e2 = buildEntity("v-2", "app-001", "v2", AppVersionStatus.DRAFT);
        PageImpl<AppVersionEntity> page = new PageImpl<>(List.of(e1, e2), PageRequest.of(0, 20), 2);
        when(appVersionRepository.findByTenantIdAndAppIdOrderByCreatedAtDesc(
                eq(TenantContext.DEFAULT_TENANT_ID), eq("app-001"), any(PageRequest.class)))
                .thenReturn(page);

        PageResponse<AppVersionResponse> result = appVersionService.list("app-001", 1, 20);

        assertThat(result.getItems()).hasSize(2);
        assertThat(result.getTotal()).isEqualTo(2);
        assertThat(result.getPage()).isEqualTo(1);
        assertThat(result.getPageSize()).isEqualTo(20);
    }

    @Test
    void get_returns_response_when_found() {
        AppVersionEntity entity = buildEntity("v-1", "app-001", "v1", AppVersionStatus.DRAFT);
        when(appVersionRepository.findByIdAndTenantId("v-1", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(entity));

        AppVersionResponse response = appVersionService.get("v-1");

        assertThat(response.getVersionId()).isEqualTo("v-1");
        assertThat(response.getAppId()).isEqualTo("app-001");
    }

    @Test
    void get_throws_404_when_not_found() {
        when(appVersionRepository.findByIdAndTenantId("missing", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> appVersionService.get("missing"))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.APP_VERSION_NOT_FOUND);
    }

    @Test
    void publish_offlines_existing_published_and_marks_target_published() {
        AppVersionEntity target = buildEntity("v-2", "app-001", "v2", AppVersionStatus.DRAFT);
        AppVersionEntity currentPublished = buildEntity("v-1", "app-001", "v1", AppVersionStatus.PUBLISHED);
        when(appVersionRepository.findByIdAndTenantId("v-2", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(target));
        when(appVersionRepository.findFirstByTenantIdAndAppIdAndStatusOrderByCreatedAtDesc(
                TenantContext.DEFAULT_TENANT_ID, "app-001", AppVersionStatus.PUBLISHED))
                .thenReturn(Optional.of(currentPublished));
        when(appVersionRepository.save(any(AppVersionEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        AppVersionResponse response = appVersionService.publish("v-2");

        assertThat(response.getStatus()).isEqualTo("PUBLISHED");
        assertThat(currentPublished.getStatus()).isEqualTo(AppVersionStatus.OFFLINE);
        verify(wfeOutboxService).publishEvent(
                eq(TenantContext.DEFAULT_TENANT_ID), anyString(), eq("APP_VERSION_PUBLISHED"), any(), any());
    }

    @Test
    void publish_throws_409_when_already_published() {
        AppVersionEntity target = buildEntity("v-1", "app-001", "v1", AppVersionStatus.PUBLISHED);
        when(appVersionRepository.findByIdAndTenantId("v-1", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(target));

        assertThatThrownBy(() -> appVersionService.publish("v-1"))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.APP_VERSION_STATUS_CONFLICT);
    }

    @Test
    void rollback_creates_new_rollback_version_and_offlines_current_published() {
        AppVersionEntity source = buildEntity("v-1", "app-001", "v1", AppVersionStatus.PUBLISHED);
        AppVersionEntity currentPublished = buildEntity("v-1", "app-001", "v1", AppVersionStatus.PUBLISHED);
        when(appVersionRepository.findByIdAndTenantId("v-1", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(source));
        when(appVersionRepository.findFirstByTenantIdAndAppIdAndStatusOrderByCreatedAtDesc(
                TenantContext.DEFAULT_TENANT_ID, "app-001", AppVersionStatus.PUBLISHED))
                .thenReturn(Optional.of(currentPublished));
        when(appVersionRepository.save(any(AppVersionEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        AppVersionResponse response = appVersionService.rollback("v-1");

        assertThat(response.getStatus()).isEqualTo("ROLLBACK");
        assertThat(response.getRolledBackAt()).isNotNull();
        assertThat(currentPublished.getStatus()).isEqualTo(AppVersionStatus.OFFLINE);
        verify(wfeOutboxService).publishEvent(
                eq(TenantContext.DEFAULT_TENANT_ID), anyString(), eq("APP_VERSION_ROLLBACK"), any(), any());
    }

    @Test
    void rollback_throws_409_when_source_is_draft() {
        AppVersionEntity source = buildEntity("v-1", "app-001", "v1", AppVersionStatus.DRAFT);
        when(appVersionRepository.findByIdAndTenantId("v-1", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(source));

        assertThatThrownBy(() -> appVersionService.rollback("v-1"))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.APP_VERSION_STATUS_CONFLICT);
    }

    @Test
    void delete_removes_when_not_published() {
        AppVersionEntity entity = buildEntity("v-1", "app-001", "v1", AppVersionStatus.DRAFT);
        when(appVersionRepository.findByIdAndTenantId("v-1", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(entity));

        appVersionService.delete("v-1");

        verify(appVersionRepository).delete(entity);
        verify(wfeOutboxService).publishEvent(
                eq(TenantContext.DEFAULT_TENANT_ID), anyString(), eq("APP_VERSION_DELETED"), any(), any());
    }

    @Test
    void delete_throws_409_when_published() {
        AppVersionEntity entity = buildEntity("v-1", "app-001", "v1", AppVersionStatus.PUBLISHED);
        when(appVersionRepository.findByIdAndTenantId("v-1", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> appVersionService.delete("v-1"))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.APP_VERSION_STATUS_CONFLICT);
        verify(appVersionRepository, never()).delete(any());
    }

    @Test
    void compare_returns_added_removed_modified() {
        AppVersionEntity a = AppVersionEntity.builder()
                .id("v-a").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .appId("app-001").version("v1")
                .snapshot("{\"a\":\"1\",\"b\":\"2\",\"c\":\"3\"}")
                .status(AppVersionStatus.PUBLISHED).build();
        AppVersionEntity b = AppVersionEntity.builder()
                .id("v-b").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .appId("app-001").version("v2")
                .snapshot("{\"a\":\"1\",\"b\":\"X\",\"d\":\"4\"}")
                .status(AppVersionStatus.PUBLISHED).build();
        when(appVersionRepository.findByIdAndTenantId("v-a", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(a));
        when(appVersionRepository.findByIdAndTenantId("v-b", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(b));

        Map<String, List<String>> diff = appVersionService.compare("v-a", "v-b");

        assertThat(diff.get("added")).containsExactly("d");
        assertThat(diff.get("removed")).containsExactly("c");
        assertThat(diff.get("modified")).containsExactly("b");
    }
}
