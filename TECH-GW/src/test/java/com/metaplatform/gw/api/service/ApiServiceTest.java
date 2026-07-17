package com.metaplatform.gw.api.service;

import com.metaplatform.gw.api.dto.ApiListItem;
import com.metaplatform.gw.api.dto.ApiResponse;
import com.metaplatform.gw.api.dto.CreateApiRequest;
import com.metaplatform.gw.api.dto.UpdateApiRequest;
import com.metaplatform.gw.api.entity.GwApiEntity;
import com.metaplatform.gw.api.repository.GwApiRepository;
import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.test.StepVerifier;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApiServiceTest {

    @Mock
    private GwApiRepository apiRepository;

    @InjectMocks
    private ApiService apiService;

    @Test
    void createApi_persistsEntity() {
        CreateApiRequest request = CreateApiRequest.builder()
                .name("Get User")
                .path("/api/v1/users/{id}")
                .method("GET")
                .groupName("user")
                .version("v1")
                .tenantId("tenant-default")
                .build();

        when(apiRepository.existsByTenantIdAndPathAndMethodAndVersionAndDeletedAtIsNull(
                anyString(), anyString(), anyString(), anyString())).thenReturn(false);
        when(apiRepository.save(any(GwApiEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        StepVerifier.create(apiService.createApi(request))
                .assertNext(response -> {
                    assertThat(response.getName()).isEqualTo("Get User");
                    assertThat(response.getMethod()).isEqualTo("GET");
                    assertThat(response.getStatus()).isEqualTo("ACTIVE");
                    assertThat(response.getId()).isNotNull();
                })
                .verifyComplete();

        verify(apiRepository, times(1)).save(any(GwApiEntity.class));
    }

    @Test
    void createApi_rejectsDuplicate() {
        CreateApiRequest request = CreateApiRequest.builder()
                .name("Get User")
                .path("/api/v1/users/{id}")
                .method("GET")
                .build();

        when(apiRepository.existsByTenantIdAndPathAndMethodAndVersionAndDeletedAtIsNull(
                anyString(), anyString(), anyString(), anyString())).thenReturn(true);

        StepVerifier.create(apiService.createApi(request))
                .expectErrorSatisfies(err -> {
                    assertThat(err).isInstanceOf(ApiService.ApiException.class);
                    assertThat(((ApiService.ApiException) err).getErrorCode())
                            .isEqualTo(ErrorCode.ROUTE_ALREADY_EXISTS);
                })
                .verify();

        verify(apiRepository, never()).save(any(GwApiEntity.class));
    }

    @Test
    void createApi_rejectsInvalidMethod() {
        CreateApiRequest request = CreateApiRequest.builder()
                .name("Bad")
                .path("/api/v1/foo")
                .method("INVALID")
                .build();

        StepVerifier.create(apiService.createApi(request))
                .expectErrorSatisfies(err -> assertThat(err).isInstanceOf(ApiService.ApiException.class))
                .verify();

        verify(apiRepository, never()).save(any(GwApiEntity.class));
    }

    @Test
    void listApis_filtersByGroupAndKeyword() {
        GwApiEntity entity = sampleApi(UUID.randomUUID(), "user");
        when(apiRepository.searchApis(eq("tenant-default"), eq("user"), any(), any(),
                any())).thenReturn(org.springframework.data.domain.Page.empty());

        StepVerifier.create(apiService.listApis(1, 20, "tenant-default", "user", null, null))
                .assertNext(page -> assertThat(page.getItems()).isEmpty())
                .verifyComplete();
    }

    @Test
    void listByGroup_returnsItems() {
        GwApiEntity entity = sampleApi(UUID.randomUUID(), "group-a");
        org.springframework.data.domain.Page<GwApiEntity> page =
                new org.springframework.data.domain.PageImpl<>(List.of(entity));
        when(apiRepository
                .findByTenantIdAndGroupNameAndDeletedAtIsNullOrderByCreatedAtDesc(
                        eq("tenant-default"), eq("group-a"), any()))
                .thenReturn(page);

        StepVerifier.create(apiService.listByGroup("group-a", 1, 20, "tenant-default"))
                .assertNext(p -> {
                    assertThat(p.getItems()).hasSize(1);
                    assertThat(p.getItems().get(0).getGroupName()).isEqualTo("group-a");
                })
                .verifyComplete();
    }

    @Test
    void getApi_returnsEntity() {
        UUID id = UUID.randomUUID();
        when(apiRepository.findByIdAndDeletedAtIsNull(id))
                .thenReturn(Optional.of(sampleApi(id, "user")));

        StepVerifier.create(apiService.getApi(id))
                .assertNext(r -> assertThat(r.getId()).isEqualTo(id))
                .verifyComplete();
    }

    @Test
    void updateApi_appliesPartialChanges() {
        UUID id = UUID.randomUUID();
        GwApiEntity entity = sampleApi(id, "user");
        when(apiRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(apiRepository.save(any(GwApiEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateApiRequest request = UpdateApiRequest.builder()
                .description("updated")
                .status("DEPRECATED")
                .build();

        StepVerifier.create(apiService.updateApi(id, request))
                .assertNext(r -> {
                    assertThat(r.getDescription()).isEqualTo("updated");
                    assertThat(r.getStatus()).isEqualTo("DEPRECATED");
                })
                .verifyComplete();
    }

    @Test
    void deleteApi_marksDeletedAt() {
        UUID id = UUID.randomUUID();
        GwApiEntity entity = sampleApi(id, "user");
        when(apiRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(apiRepository.save(any(GwApiEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        StepVerifier.create(apiService.deleteApi(id)).verifyComplete();

        verify(apiRepository, times(1)).save(any(GwApiEntity.class));
    }

    private GwApiEntity sampleApi(UUID id, String group) {
        return GwApiEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("Sample")
                .path("/api/v1/sample")
                .method("GET")
                .groupName(group)
                .version("v1")
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
