package com.metaplatform.obs.service;

import com.metaplatform.obs.config.ObsLokiProperties;
import com.metaplatform.obs.config.ObsQueryProperties;
import com.metaplatform.obs.dto.LogEntry;
import com.metaplatform.obs.dto.LogQueryRequest;
import com.metaplatform.obs.dto.PageResponse;
import com.metaplatform.obs.dto.loki.LokiQueryResponse;
import com.metaplatform.obs.exception.ObsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LokiQueryServiceTest {

    private RestTemplate restTemplate;
    private ObsLokiProperties lokiProperties;
    private ObsQueryProperties queryProperties;
    private LokiQueryService service;

    @BeforeEach
    void setUp() {
        restTemplate = mock(RestTemplate.class);
        lokiProperties = new ObsLokiProperties();
        lokiProperties.setBaseUrl("http://loki:3100");
        lokiProperties.setQueryPath("/loki/api/v1/query_range");
        queryProperties = new ObsQueryProperties();
        queryProperties.setMaxTimeRangeHours(168);
        queryProperties.setDefaultPageSize(50);
        queryProperties.setMaxPageSize(500);
        service = new LokiQueryService(restTemplate, lokiProperties, queryProperties);
    }

    @Test
    @DisplayName("buildLogqlLabelSelector 应拼接 service/level/trace_id")
    void shouldBuildLabelSelector() {
        LogQueryRequest req = new LogQueryRequest();
        req.setServiceName("iam");
        req.setLevel("ERROR");
        req.setTraceId("trace-123");

        String selector = service.buildLogqlLabelSelector(req);

        assertThat(selector).isEqualTo("service=\"iam\",level=\"ERROR\",trace_id=\"trace-123\"");
    }

    @Test
    @DisplayName("buildLogqlPipeline 在无 keyword 时应返回空串")
    void shouldReturnEmptyPipelineWhenNoKeyword() {
        LogQueryRequest req = new LogQueryRequest();
        assertThat(service.buildLogqlPipeline(req)).isEmpty();
    }

    @Test
    @DisplayName("buildLogqlPipeline 在 keyword 含双引号/反斜杠时应正确转义")
    void shouldEscapeKeywordInPipeline() {
        LogQueryRequest req = new LogQueryRequest();
        req.setKeyword("a\"b\\c");
        assertThat(service.buildLogqlPipeline(req)).isEqualTo(" |= \"a\\\"b\\\\c\"");
    }

    @Test
    @DisplayName("query 成功时应解析 Loki 响应并分页")
    void shouldQueryAndParseLokiResponse() {
        LogQueryRequest req = new LogQueryRequest();
        req.setServiceName("iam");
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));
        req.setPage(1);
        req.setSize(10);

        LokiQueryResponse lokiResp = buildSampleLokiResponse();
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class)))
                .thenReturn(ResponseEntity.ok(lokiResp));

        PageResponse<LogEntry> page = service.query(req);

        assertThat(page.getTotal()).isEqualTo(2);
        assertThat(page.getItems()).hasSize(2);
        assertThat(page.getPage()).isEqualTo(1);
        assertThat(page.getPageSize()).isEqualTo(10);
        assertThat(page.getItems().get(0).getServiceName()).isEqualTo("iam");
        assertThat(page.getItems().get(0).getLevel()).isEqualTo("ERROR");
        assertThat(page.getItems().get(0).getMessage()).contains("login failed");
    }

    @Test
    @DisplayName("query 应将 query 关键字拼入 URL 并使用 epoch nanos")
    void shouldConstructLokiUrlWithLogql() {
        LogQueryRequest req = new LogQueryRequest();
        req.setServiceName("iam");
        req.setLevel("INFO");
        req.setKeyword("hello");
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class)))
                .thenReturn(ResponseEntity.ok(new LokiQueryResponse()));

        try {
            service.query(req);
        } catch (ObsException ignored) {
        }

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class));

        String url = urlCaptor.getValue();
        assertThat(url).contains("/loki/api/v1/query_range");
        assertThat(url).contains("query=%7Bservice%3D%22iam%22");
        assertThat(url).contains("level%3D%22INFO%22");
        assertThat(url).contains("hello%22");
        assertThat(url).contains("start=");
        assertThat(url).contains("end=");
        assertThat(url).contains("limit=50");
        assertThat(url).contains("direction=backward");
    }

    @Test
    @DisplayName("query 抛 ResourceAccessException 时应包装为 LOKI_UNAVAILABLE")
    void shouldWrapResourceAccessException() {
        LogQueryRequest req = new LogQueryRequest();
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class)))
                .thenThrow(new ResourceAccessException("connection refused"));

        assertThatThrownBy(() -> service.query(req))
                .isInstanceOf(ObsException.class)
                .hasMessageContaining("无法访问 Loki");
    }

    @Test
    @DisplayName("query 抛 HttpServerErrorException 时应包装为 LOKI_UNAVAILABLE")
    void shouldWrapHttpStatusCodeException() {
        LogQueryRequest req = new LogQueryRequest();
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class)))
                .thenThrow(HttpServerErrorException.create(HttpStatus.INTERNAL_SERVER_ERROR,
                        "boom", new org.springframework.http.HttpHeaders(), null, null));

        assertThatThrownBy(() -> service.query(req))
                .isInstanceOf(ObsException.class)
                .hasMessageContaining("Loki 返回错误状态");
    }

    @Test
    @DisplayName("query 时间范围超出限制时应抛 INVALID_TIME_RANGE")
    void shouldRejectOverRangeTimeWindow() {
        LogQueryRequest req = new LogQueryRequest();
        req.setStartTime(OffsetDateTime.of(2026, 7, 1, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));

        assertThatThrownBy(() -> service.query(req))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("query startTime 晚于 endTime 时应抛 INVALID_TIME_RANGE")
    void shouldRejectInvertedTimeRange() {
        LogQueryRequest req = new LogQueryRequest();
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 2, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        assertThatThrownBy(() -> service.query(req))
                .isInstanceOf(ObsException.class);
    }

    private LokiQueryResponse buildSampleLokiResponse() {
        LokiQueryResponse resp = new LokiQueryResponse();
        resp.setStatus("success");
        LokiQueryResponse.LokiData data = new LokiQueryResponse.LokiData();
        resp.setData(data);

        LokiQueryResponse.LokiStream stream = new LokiQueryResponse.LokiStream();
        LokiQueryResponse.LokiStreamLabels labels = new LokiQueryResponse.LokiStreamLabels();
        labels.setService("iam");
        labels.setLevel("ERROR");
        stream.setStream(labels);

        long baseNanos = 1752624000_000_000_000L;
        List<List<String>> values = new ArrayList<>();
        values.add(List.of(String.valueOf(baseNanos), "ERROR login failed"));
        values.add(List.of(String.valueOf(baseNanos + 1_000_000L), "INFO recovery success"));
        stream.setValues(values);

        List<LokiQueryResponse.LokiStream> streams = new ArrayList<>();
        streams.add(stream);
        data.setStreams(streams);
        return resp;
    }
}