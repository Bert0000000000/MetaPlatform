package com.metaplatform.wfe.service;

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

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * P1-WFE-08: TECH-ONT 集成测试（mock WebClient）。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OntIntegrationServiceTest {

    @Mock
    private WebClient ontWebClient;

    @InjectMocks
    private OntIntegrationService ontIntegrationService;

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void mockGet(String responseJson) {
        WebClient.RequestHeadersUriSpec uriSpec = mock(WebClient.RequestHeadersUriSpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);
        when(ontWebClient.get()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(headersSpec);
        when(headersSpec.header(anyString(), anyString())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.just(responseJson));
    }

    @Test
    void resolveEntity_shouldReturnEntity_whenSuccess() {
        mockGet("{\"code\":0,\"data\":{\"entityCode\":\"ORD-001\",\"amount\":1000,\"status\":\"PENDING\"}}");

        Map<String, Object> result = ontIntegrationService.resolveEntity("tenant-1", "ORDER", "ORD-001");

        assertThat(result).isNotNull();
        assertThat(result.get("entityCode")).isEqualTo("ORD-001");
        assertThat(result.get("amount")).isEqualTo(1000);
        assertThat(result.get("status")).isEqualTo("PENDING");
    }

    @Test
    void resolveEntity_shouldThrow_whenNotFound() {
        mockGet("{\"code\":40404,\"message\":\"not found\",\"data\":null}");

        assertThatThrownBy(() -> ontIntegrationService.resolveEntity("tenant-1", "ORDER", "ORD-999"))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("业务对象实体不存在");
    }

    @Test
    void bindProcessVariable_shouldReturnEntityData() {
        mockGet("{\"code\":0,\"data\":{\"entityCode\":\"ORD-001\",\"amount\":2000}}");

        Map<String, Object> result = ontIntegrationService.bindProcessVariable(
                "tenant-1", "pi-001", "order", "ORDER", "ORD-001");

        assertThat(result).isNotNull();
        assertThat(result.get("entityCode")).isEqualTo("ORD-001");
        assertThat(result.get("amount")).isEqualTo(2000);
    }
}
