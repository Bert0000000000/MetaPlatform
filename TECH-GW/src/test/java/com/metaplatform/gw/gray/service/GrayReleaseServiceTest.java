package com.metaplatform.gw.gray.service;

import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.gray.dto.CreateGrayReleaseRequest;
import com.metaplatform.gw.gray.entity.GwGrayReleaseEntity;
import com.metaplatform.gw.gray.repository.GwGrayReleaseRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import reactor.test.StepVerifier;

import java.net.InetSocketAddress;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GrayReleaseServiceTest {

    @Mock
    private GwGrayReleaseRepository repository;

    @InjectMocks
    private GrayReleaseService service;

    @Test
    void create_persistsEntity() {
        when(repository.save(any(GwGrayReleaseEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateGrayReleaseRequest request = CreateGrayReleaseRequest.builder()
                .name("v2 rollout")
                .strategy("PERCENTAGE")
                .newVersion("v2")
                .oldVersion("v1")
                .strategyConfig(Map.of("percentage", 25.0))
                .build();

        StepVerifier.create(service.create(request))
                .assertNext(r -> {
                    assertThat(r.getStatus()).isEqualTo("DRAFT");
                    assertThat(r.getStrategy()).isEqualTo("PERCENTAGE");
                })
                .verifyComplete();
    }

    @Test
    void create_rejectsInvalidStrategy() {
        CreateGrayReleaseRequest request = CreateGrayReleaseRequest.builder()
                .name("bad")
                .strategy("BAD")
                .build();

        StepVerifier.create(service.create(request))
                .expectErrorSatisfies(err -> {
                    assertThat(err).isInstanceOf(GrayReleaseService.GrayReleaseException.class);
                    assertThat(((GrayReleaseService.GrayReleaseException) err).getErrorCode())
                            .isEqualTo(ErrorCode.INVALID_FIELD_VALUE);
                })
                .verify();
    }

    @Test
    void get_returnsRule() {
        UUID id = UUID.randomUUID();
        when(repository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(activeRelease("PERCENTAGE")));

        StepVerifier.create(service.get(id))
                .assertNext(r -> assertThat(r.getStrategy()).isEqualTo("PERCENTAGE"))
                .verifyComplete();
    }

    @Test
    void start_stop_complete_changeStatus() {
        UUID id = UUID.randomUUID();
        GwGrayReleaseEntity entity = activeRelease("PERCENTAGE");
        when(repository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StepVerifier.create(service.start(id)).assertNext(r -> assertThat(r.getStatus()).isEqualTo("ACTIVE")).verifyComplete();
        StepVerifier.create(service.stop(id)).assertNext(r -> assertThat(r.getStatus()).isEqualTo("STOPPED")).verifyComplete();
        StepVerifier.create(service.complete(id)).assertNext(r -> assertThat(r.getStatus()).isEqualTo("COMPLETED")).verifyComplete();
    }

    @Test
    void matchRequest_percentage_whenBucketBelowThreshold() {
        UUID apiId = UUID.randomUUID();
        GwGrayReleaseEntity release = activeRelease("PERCENTAGE");
        release.setApiId(apiId);
        release.setStrategyConfig(Map.of("percentage", 100.0));
        when(repository.findByApiIdAndStatusAndDeletedAtIsNull(apiId, "ACTIVE"))
                .thenReturn(List.of(release));

        ServerHttpRequest request = MockServerHttpRequest.get("/api/v1/test").build();
        Optional<GwGrayReleaseEntity> match = service.matchRequest(apiId, request);

        assertThat(match).isPresent();
    }

    @Test
    void matchRequest_header_matchesConfiguredValue() {
        UUID apiId = UUID.randomUUID();
        GwGrayReleaseEntity release = activeRelease("HEADER");
        release.setApiId(apiId);
        release.setStrategyConfig(Map.of("headerName", "X-Cohort", "expectedValue", "beta"));
        when(repository.findByApiIdAndStatusAndDeletedAtIsNull(apiId, "ACTIVE"))
                .thenReturn(List.of(release));

        ServerHttpRequest matching = MockServerHttpRequest.get("/api/v1/test")
                .header("X-Cohort", "beta").build();
        assertThat(service.matchRequest(apiId, matching)).isPresent();

        ServerHttpRequest nonMatching = MockServerHttpRequest.get("/api/v1/test")
                .header("X-Cohort", "stable").build();
        assertThat(service.matchRequest(apiId, nonMatching)).isEmpty();
    }

    @Test
    void matchRequest_user_matchesAllowedList() {
        UUID apiId = UUID.randomUUID();
        GwGrayReleaseEntity release = activeRelease("USER");
        release.setApiId(apiId);
        release.setStrategyConfig(Map.of("allowedUsers", List.of("user-1", "user-2")));
        when(repository.findByApiIdAndStatusAndDeletedAtIsNull(apiId, "ACTIVE"))
                .thenReturn(List.of(release));

        ServerHttpRequest matching = MockServerHttpRequest.get("/api/v1/test")
                .header("X-User-Id", "user-1").build();
        assertThat(service.matchRequest(apiId, matching)).isPresent();

        ServerHttpRequest nonMatching = MockServerHttpRequest.get("/api/v1/test")
                .header("X-User-Id", "user-3").build();
        assertThat(service.matchRequest(apiId, nonMatching)).isEmpty();
    }

    @Test
    void matchRequest_ip_matchesAllowedList() {
        UUID apiId = UUID.randomUUID();
        GwGrayReleaseEntity release = activeRelease("IP");
        release.setApiId(apiId);
        release.setStrategyConfig(Map.of("allowedIps", List.of("127.0.0.1")));
        when(repository.findByApiIdAndStatusAndDeletedAtIsNull(apiId, "ACTIVE"))
                .thenReturn(List.of(release));

        ServerHttpRequest matching = MockServerHttpRequest.get("/api/v1/test")
                .remoteAddress(new InetSocketAddress("127.0.0.1", 8080))
                .build();
        assertThat(service.matchRequest(apiId, matching)).isPresent();

        ServerHttpRequest nonMatching = MockServerHttpRequest.get("/api/v1/test")
                .remoteAddress(new InetSocketAddress("10.0.0.1", 8080))
                .build();
        assertThat(service.matchRequest(apiId, nonMatching)).isEmpty();
    }

    @Test
    void matchRequest_respectsTimeWindow() {
        UUID apiId = UUID.randomUUID();
        GwGrayReleaseEntity release = activeRelease("PERCENTAGE");
        release.setApiId(apiId);
        release.setStrategyConfig(Map.of("percentage", 100.0));
        release.setStartAt(LocalDateTime.now().plusDays(1));
        release.setEndAt(LocalDateTime.now().plusDays(2));
        when(repository.findByApiIdAndStatusAndDeletedAtIsNull(apiId, "ACTIVE"))
                .thenReturn(List.of(release));

        ServerHttpRequest request = MockServerHttpRequest.get("/api/v1/test").build();
        assertThat(service.matchRequest(apiId, request)).isEmpty();
    }

    @Test
    void delete_marksDeletedAt() {
        UUID id = UUID.randomUUID();
        GwGrayReleaseEntity entity = activeRelease("PERCENTAGE");
        when(repository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StepVerifier.create(service.delete(id)).verifyComplete();

        verify(repository, times(1)).save(any(GwGrayReleaseEntity.class));
    }

    private GwGrayReleaseEntity activeRelease(String strategy) {
        return GwGrayReleaseEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("release")
                .status("ACTIVE")
                .strategy(strategy)
                .strategyConfig(Map.of("percentage", 100.0))
                .newVersion("v2")
                .oldVersion("v1")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
