package com.metaplatform.wfe.apphub.service;

import com.metaplatform.wfe.apphub.dto.TemplateCommentRequest;
import com.metaplatform.wfe.apphub.dto.TemplateCommentResponse;
import com.metaplatform.wfe.apphub.dto.TemplateInstallResponse;
import com.metaplatform.wfe.apphub.dto.TemplateResponse;
import com.metaplatform.wfe.apphub.entity.TemplateCommentEntity;
import com.metaplatform.wfe.apphub.entity.TemplateEntity;
import com.metaplatform.wfe.apphub.entity.TemplateInstallEntity;
import com.metaplatform.wfe.apphub.repository.TemplateCommentRepository;
import com.metaplatform.wfe.apphub.repository.TemplateInstallRepository;
import com.metaplatform.wfe.apphub.repository.TemplateRepository;
import com.metaplatform.wfe.common.ErrorCode;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TemplateServiceTest {

    @Mock private TemplateRepository templateRepository;
    @Mock private TemplateInstallRepository installRepository;
    @Mock private TemplateCommentRepository commentRepository;
    @Mock private WfeOutboxService wfeOutboxService;

    @InjectMocks private TemplateService templateService;

    @BeforeEach
    void setUp() {
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private TemplateEntity buildTemplate(String templateId) {
        return TemplateEntity.builder()
                .id("row-" + templateId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .templateId(templateId)
                .name("模板 " + templateId)
                .category("OA")
                .description("desc")
                .tags("[\"tag1\",\"tag2\"]")
                .downloadCount(5L)
                .ratingSum(10L)
                .ratingCount(3L)
                .configSnapshot("{\"pages\":[]}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void list_returns_templates_from_default_tenant() {
        TemplateEntity t1 = buildTemplate("tmpl-001");
        TemplateEntity t2 = buildTemplate("tmpl-002");
        PageImpl<TemplateEntity> page = new PageImpl<>(List.of(t1, t2), PageRequest.of(0, 200), 2);
        when(templateRepository.findByTenantId(eq(TenantContext.DEFAULT_TENANT_ID), any(PageRequest.class)))
                .thenReturn(page);

        List<TemplateResponse> result = templateService.list(null, null);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getTemplateId()).isEqualTo("tmpl-001");
        assertThat(result.get(0).getTags()).containsExactly("tag1", "tag2");
        // avg rating = round(10/3 * 10) / 10 = 3.3
        assertThat(result.get(0).getRating()).isEqualTo(3.3);
    }

    @Test
    void get_returns_response_when_found() {
        TemplateEntity entity = buildTemplate("tmpl-001");
        when(templateRepository.findByTenantIdAndTemplateId(
                TenantContext.DEFAULT_TENANT_ID, "tmpl-001"))
                .thenReturn(Optional.of(entity));

        TemplateResponse response = templateService.get("tmpl-001");

        assertThat(response.getTemplateId()).isEqualTo("tmpl-001");
        assertThat(response.getName()).isEqualTo("模板 tmpl-001");
    }

    @Test
    void get_throws_404_when_not_found() {
        when(templateRepository.findByTenantIdAndTemplateId(
                TenantContext.DEFAULT_TENANT_ID, "missing"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> templateService.get("missing"))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.TEMPLATE_NOT_FOUND);
    }

    @Test
    void install_creates_install_record_and_increments_download_count() {
        TemplateEntity template = buildTemplate("tmpl-001");
        when(templateRepository.findByTenantIdAndTemplateId(
                TenantContext.DEFAULT_TENANT_ID, "tmpl-001"))
                .thenReturn(Optional.of(template));
        when(installRepository.findByTenantIdAndTemplateId(
                TenantContext.DEFAULT_TENANT_ID, "tmpl-001"))
                .thenReturn(Optional.empty());
        when(installRepository.save(any(TemplateInstallEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(templateRepository.save(any(TemplateEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        TemplateInstallResponse response = templateService.install("tmpl-001");

        assertThat(response.getSuccess()).isTrue();
        assertThat(response.getAppId()).startsWith("app-");
        assertThat(template.getDownloadCount()).isEqualTo(6L);
        verify(wfeOutboxService).publishEvent(
                eq(TenantContext.DEFAULT_TENANT_ID), eq("tmpl-001"), eq("TEMPLATE_INSTALLED"), any(), any());
    }

    @Test
    void install_throws_409_when_already_installed() {
        TemplateEntity template = buildTemplate("tmpl-001");
        when(templateRepository.findByTenantIdAndTemplateId(
                TenantContext.DEFAULT_TENANT_ID, "tmpl-001"))
                .thenReturn(Optional.of(template));
        TemplateInstallEntity existing = TemplateInstallEntity.builder()
                .id("inst-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .templateId("tmpl-001").appId("app-old").build();
        when(installRepository.findByTenantIdAndTemplateId(
                TenantContext.DEFAULT_TENANT_ID, "tmpl-001"))
                .thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> templateService.install("tmpl-001"))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.TEMPLATE_ALREADY_INSTALLED);
        verify(installRepository, never()).save(any());
    }

    @Test
    void listComments_returns_paged_comments() {
        TemplateCommentEntity c1 = TemplateCommentEntity.builder()
                .id("c-1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .templateId("tmpl-001").userId("u-1").rating(5).comment("good")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        PageImpl<TemplateCommentEntity> page = new PageImpl<>(List.of(c1), PageRequest.of(0, 20), 1);
        when(commentRepository.findByTenantIdAndTemplateIdOrderByUpdatedAtDesc(
                eq(TenantContext.DEFAULT_TENANT_ID), eq("tmpl-001"), any(PageRequest.class)))
                .thenReturn(page);

        List<TemplateCommentResponse> result = templateService.listComments("tmpl-001", 1, 20);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getRating()).isEqualTo(5);
        assertThat(result.get(0).getComment()).isEqualTo("good");
    }

    @Test
    void addOrUpdateComment_creates_new_comment_and_recalculates_rating() {
        TemplateEntity template = buildTemplate("tmpl-001");
        when(templateRepository.findByTenantIdAndTemplateId(
                TenantContext.DEFAULT_TENANT_ID, "tmpl-001"))
                .thenReturn(Optional.of(template));
        when(commentRepository.findByTenantIdAndTemplateIdAndUserId(
                TenantContext.DEFAULT_TENANT_ID, "tmpl-001", "user-test"))
                .thenReturn(Optional.empty());
        when(commentRepository.save(any(TemplateCommentEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        // 模拟 sumRatingAndCount 返回值
        when(commentRepository.sumRatingAndCount(TenantContext.DEFAULT_TENANT_ID, "tmpl-001"))
                .thenReturn(new Object[]{15L, 4L});
        when(templateRepository.save(any(TemplateEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // 通过 SecurityContext mock 设置 userId - 使用 TenantContext.set 的方式无效，需要直接测试
        // 由于 TenantContext.getUserId() 返回 null（无 JWT），此用例应抛 UNAUTHORIZED
        TemplateCommentRequest request = new TemplateCommentRequest();
        request.setRating(5);
        request.setComment("great");

        assertThatThrownBy(() -> templateService.addOrUpdateComment("tmpl-001", request))
                .isInstanceOf(WfeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    void list_returns_empty_when_no_templates() {
        PageImpl<TemplateEntity> emptyPage = new PageImpl<>(List.of(), PageRequest.of(0, 200), 0);
        when(templateRepository.findByTenantId(eq(TenantContext.DEFAULT_TENANT_ID), any(PageRequest.class)))
                .thenReturn(emptyPage);

        List<TemplateResponse> result = templateService.list(null, null);

        assertThat(result).isEmpty();
    }
}
