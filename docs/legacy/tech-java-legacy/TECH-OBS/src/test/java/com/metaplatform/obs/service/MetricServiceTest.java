package com.metaplatform.obs.service;

import com.metaplatform.obs.config.ObsPrometheusProperties;
import com.metaplatform.obs.dto.MetricInfo;
import com.metaplatform.obs.dto.MetricQueryRequest;
import com.metaplatform.obs.dto.MetricQueryResponse;
import com.metaplatform.obs.exception.ObsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MetricServiceTest {

    private RestTemplate restTemplate;
    private ObsPrometheusProperties prometheusProperties;
    private MetricService metricService;

    @BeforeEach
    void setUp() {
        restTemplate = mock(RestTemplate.class);
        prometheusProperties = new ObsPrometheusProperties();
        prometheusProperties.setBaseUrl("http://localhost:9090");
        metricService = new MetricService(restTemplate, prometheusProperties);
    }

    @Test
    @DisplayName("listMetrics - 返回可用指标列表")
    void listMetrics_shouldReturnMetricList() {
        String responseBody = "{\"status\":\"success\",\"data\":[\"http_requests_total\",\"jvm_memory_used_bytes\"]}";
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        List<MetricInfo> result = metricService.listMetrics();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getName()).isEqualTo("http_requests_total");
        assertThat(result.get(1).getName()).isEqualTo("jvm_memory_used_bytes");
    }

    @Test
    @DisplayName("getMetricMetadata - 返回指标类型和帮助信息")
    void getMetricMetadata_shouldReturnInfo() {
        String metricName = "http_requests_total";
        String responseBody = "{\"status\":\"success\",\"data\":{\"http_requests_total\":[{\"type\":\"counter\",\"help\":\"Total HTTP requests\"}]}}";
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        MetricInfo info = metricService.getMetricMetadata(metricName);

        assertThat(info.getName()).isEqualTo("http_requests_total");
        assertThat(info.getType()).isEqualTo("counter");
        assertThat(info.getHelp()).isEqualTo("Total HTTP requests");
    }

    @Test
    @DisplayName("queryMetrics - 返回时间序列数据")
    void queryMetrics_shouldReturnTimeSeries() {
        MetricQueryRequest request = new MetricQueryRequest();
        request.setMetricName("http_requests_total");
        Map<String, String> labels = new HashMap<>();
        labels.put("job", "tech-iam");
        request.setLabels(labels);
        request.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        request.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));
        request.setStep("60s");

        String responseBody = "{\"status\":\"success\",\"data\":{\"result\":[{\"metric\":{\"job\":\"tech-iam\"},\"values\":[[1752931200,\"100\"],[1752931260,\"105\"]]}]}}";
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        MetricQueryResponse response = metricService.queryMetrics(request);

        assertThat(response.getMetricName()).isEqualTo("http_requests_total");
        assertThat(response.getResults()).hasSize(1);
        assertThat(response.getResults().get(0).getLabels()).containsEntry("job", "tech-iam");
        assertThat(response.getResults().get(0).getValues()).hasSize(2);
        assertThat(response.getResults().get(0).getValues().get(0).getValue()).isEqualTo(100.0);
    }

    @Test
    @DisplayName("queryMetrics - Prometheus 不可用时抛异常")
    void queryMetrics_shouldThrowWhenPrometheusUnavailable() {
        MetricQueryRequest request = new MetricQueryRequest();
        request.setMetricName("test_metric");
        request.setStartTime(OffsetDateTime.now(ZoneOffset.UTC));
        request.setEndTime(OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(1));
        request.setStep("60s");

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new ResourceAccessException("Connection refused"));

        assertThatThrownBy(() -> metricService.queryMetrics(request))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("buildPromql - 构建 PromQL 查询字符串")
    void buildPromql_shouldBuildCorrectQuery() {
        Map<String, String> labels = new HashMap<>();
        labels.put("job", "tech-iam");
        labels.put("instance", "localhost:8101");

        String promql = metricService.buildPromql("http_requests_total", labels);

        assertThat(promql).startsWith("http_requests_total{");
        assertThat(promql).contains("job=\"tech-iam\"");
        assertThat(promql).contains("instance=\"localhost:8101\"");
        assertThat(promql).endsWith("}");
    }

    @Test
    @DisplayName("buildPromql - 无标签时仅返回指标名")
    void buildPromql_shouldReturnMetricNameOnlyWhenNoLabels() {
        String promql = metricService.buildPromql("up", null);
        assertThat(promql).isEqualTo("up");
    }
}
