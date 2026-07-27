package com.metaplatform.wfe.service;

import com.metaplatform.wfe.dto.AssigneeInfo;
import com.metaplatform.wfe.exception.WfeException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * P1-WFE-06: TECH-IAM 集成测试（mock WebClient）。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IamIntegrationServiceTest {

    @Mock
    private WebClient iamWebClient;

    @InjectMocks
    private IamIntegrationService iamIntegrationService;

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void mockGet(String responseJson) {
        WebClient.RequestHeadersUriSpec uriSpec = mock(WebClient.RequestHeadersUriSpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);
        when(iamWebClient.get()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(headersSpec);
        when(headersSpec.header(anyString(), anyString())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.just(responseJson));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void mockPost(String responseJson) {
        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        WebClient.RequestBodySpec bodySpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);
        when(iamWebClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.header(anyString(), anyString())).thenReturn(bodySpec);
        when(bodySpec.bodyValue(any())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.just(responseJson));
    }

    @Test
    void resolveAssignees_byDept_shouldReturnList() {
        mockGet("{\"code\":0,\"data\":[" +
                "{\"userId\":\"u1\",\"username\":\"alice\"}," +
                "{\"userId\":\"u2\",\"username\":\"bob\"}]}");

        List<AssigneeInfo> result = iamIntegrationService.resolveAssignees("tenant-1", null, "dept-001");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getUserId()).isEqualTo("u1");
        assertThat(result.get(0).getUsername()).isEqualTo("alice");
        assertThat(result.get(1).getUserId()).isEqualTo("u2");
    }

    @Test
    void resolveAssignees_byRole_shouldReturnList() {
        mockGet("{\"code\":0,\"data\":[{\"userId\":\"u3\",\"username\":\"carol\"}]}");

        List<AssigneeInfo> result = iamIntegrationService.resolveAssignees("tenant-1", "MANAGER", null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getUserId()).isEqualTo("u3");
        assertThat(result.get(0).getUsername()).isEqualTo("carol");
    }

    @Test
    void checkPermission_shouldReturnTrue_whenAllowed() {
        mockPost("{\"code\":0,\"data\":{\"allowed\":true}}");

        boolean allowed = iamIntegrationService.checkPermission("tenant-1", "u1", "task:t1", "approve");

        assertThat(allowed).isTrue();
    }

    @Test
    void checkPermission_shouldReturnFalse_whenNotAllowed() {
        mockPost("{\"code\":0,\"data\":{\"allowed\":false}}");

        boolean allowed = iamIntegrationService.checkPermission("tenant-1", "u1", "task:t1", "approve");

        assertThat(allowed).isFalse();
    }

    @Test
    void checkPermission_shouldThrow_whenWebClientFails() {
        when(iamWebClient.post()).thenThrow(new RuntimeException("connection refused"));

        assertThatThrownBy(() -> iamIntegrationService.checkPermission("tenant-1", "u1", "task:t1", "approve"))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("权限校验失败");
    }
}
