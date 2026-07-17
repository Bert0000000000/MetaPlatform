package com.metaplatform.obs.service;

import com.metaplatform.obs.config.ObsLokiProperties;
import com.metaplatform.obs.config.ObsQueryProperties;
import com.metaplatform.obs.dto.LogSearchRequest;
import com.metaplatform.obs.dto.LogSearchResponse;
import com.metaplatform.obs.dto.RegexSearchRequest;
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

class LogSearchServiceTest {

    private RestTemplate restTemplate;
    private ObsLokiProperties lokiProperties;
    private ObsQueryProperties queryProperties;
    private LogSearchService service;

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
        service = new LogSearchService(restTemplate, lokiProperties, queryProperties);
    }

    @Test
    @DisplayName("buildKeywordLogql 应构建 {job=\"service\"} |= \"keyword\" 并按 level 过滤")
    void shouldBuildKeywordLogql() {
        String logql = service.buildKeywordLogql("tech-iam", "error", "ERROR");
        assertThat(logql).isEqualTo("{job=\"tech-iam\"} |= \"error\" | json | level = \"ERROR\"");
    }

    @Test
    @DisplayName("buildKeywordLogql 无 service 时应使用 {job=~\".+\"}")
    void shouldBuildKeywordLogqlWithoutService() {
        String logql = service.buildKeywordLogql(null, "error", null);
        assertThat(logql).isEqualTo("{job=~\".+\"} |= \"error\"");
    }

    @Test
    @DisplayName("buildRegexLogql 应构建 {job=\"service\"} |~ \"pattern\"")
    void shouldBuildRegexLogql() {
        String logql = service.buildRegexLogql("tech-iam", "ERROR.*timeout", null);
        assertThat(logql).isEqualTo("{job=\"tech-iam\"} |~ \"ERROR.*timeout\"");
    }

    @Test
    @DisplayName("search 成功时应解析 Loki 响应并返回高亮位置")
    void shouldSearchAndReturnHighlights() {
        LogSearchRequest req = new LogSearchRequest();
        req.setKeyword("ERROR");
        req.setService("tech-iam");
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));
        req.setPage(1);
        req.setSize(50);

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class)))
                .thenReturn(ResponseEntity.ok(buildSampleLokiResponse()));

        LogSearchResponse resp = service.search(req);

        assertThat(resp.getTotal()).isEqualTo(1);
        assertThat(resp.getResults()).hasSize(1);
        LogSearchResponse.LogSearchResult result = resp.getResults().get(0);
        assertThat(result.getService()).isEqualTo("tech-iam");
        assertThat(result.getLevel()).isEqualTo("ERROR");
        assertThat(result.getMessage()).isEqualTo("ERROR login failed");
        assertThat(result.getHighlights()).hasSize(1);
        assertThat(result.getHighlights().get(0).getStart()).isEqualTo(0);
        assertThat(result.getHighlights().get(0).getEnd()).isEqualTo(5);
        assertThat(result.getHighlights().get(0).getText()).isEqualTo("ERROR");
    }

    @Test
    @DisplayName("search 应将 LogQL 拼入 URL 并使用 epoch nanos")
    void shouldConstructLokiUrlWithLogql() {
        LogSearchRequest req = new LogSearchRequest();
        req.setKeyword("error");
        req.setService("tech-iam");
        req.setLevel("ERROR");
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class)))
                .thenReturn(ResponseEntity.ok(new LokiQueryResponse()));

        try {
            service.search(req);
        } catch (ObsException ignored) {
        }

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class));

        String url = urlCaptor.getValue();
        assertThat(url).contains("/loki/api/v1/query_range");
        assertThat(url).contains("query=%7Bjob%3D%22tech-iam%22%7D");
        assertThat(url).contains("%7C%3D%20%22error%22");
        assertThat(url).contains("start=");
        assertThat(url).contains("end=");
        assertThat(url).contains("direction=backward");
    }

    @Test
    @DisplayName("searchRegex 成功时应解析 Loki 响应并返回正则匹配高亮")
    void shouldSearchRegexAndReturnHighlights() {
        RegexSearchRequest req = new RegexSearchRequest();
        req.setPattern("ERROR.*failed");
        req.setService("tech-iam");
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class)))
                .thenReturn(ResponseEntity.ok(buildSampleLokiResponse()));

        LogSearchResponse resp = service.searchRegex(req);

        assertThat(resp.getTotal()).isEqualTo(1);
        LogSearchResponse.LogSearchResult result = resp.getResults().get(0);
        assertThat(result.getHighlights()).hasSize(1);
        assertThat(result.getHighlights().get(0).getStart()).isEqualTo(0);
        assertThat(result.getHighlights().get(0).getEnd()).isEqualTo(18);
        assertThat(result.getHighlights().get(0).getText()).isEqualTo("ERROR login failed");
    }

    @Test
    @DisplayName("searchRegex 遇到非法正则时应抛 INVALID_FIELD_VALUE")
    void shouldRejectInvalidRegex() {
        RegexSearchRequest req = new RegexSearchRequest();
        req.setPattern("[invalid");
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        assertThatThrownBy(() -> service.searchRegex(req))
                .isInstanceOf(ObsException.class)
                .hasMessageContaining("正则表达式不合法");
    }

    @Test
    @DisplayName("search 抛 ResourceAccessException 时应包装为 LOKI_UNAVAILABLE")
    void shouldWrapResourceAccessException() {
        LogSearchRequest req = new LogSearchRequest();
        req.setKeyword("error");
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class)))
                .thenThrow(new ResourceAccessException("connection refused"));

        assertThatThrownBy(() -> service.search(req))
                .isInstanceOf(ObsException.class)
                .hasMessageContaining("无法访问 Loki");
    }

    @Test
    @DisplayName("search 抛 HttpServerErrorException 时应包装为 LOKI_UNAVAILABLE")
    void shouldWrapHttpStatusCodeException() {
        LogSearchRequest req = new LogSearchRequest();
        req.setKeyword("error");
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET),
                any(HttpEntity.class), eq(LokiQueryResponse.class)))
                .thenThrow(HttpServerErrorException.create(HttpStatus.INTERNAL_SERVER_ERROR,
                        "boom", new org.springframework.http.HttpHeaders(), null, null));

        assertThatThrownBy(() -> service.search(req))
                .isInstanceOf(ObsException.class)
                .hasMessageContaining("Loki 返回错误状态");
    }

    @Test
    @DisplayName("search 时间范围超出限制时应抛 INVALID_TIME_RANGE")
    void shouldRejectOverRangeTimeWindow() {
        LogSearchRequest req = new LogSearchRequest();
        req.setKeyword("error");
        req.setStartTime(OffsetDateTime.of(2026, 7, 1, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));

        assertThatThrownBy(() -> service.search(req))
                .isInstanceOf(ObsException.class);
    }

    private LokiQueryResponse buildSampleLokiResponse() {
        LokiQueryResponse resp = new LokiQueryResponse();
        resp.setStatus("success");
        LokiQueryResponse.LokiData data = new LokiQueryResponse.LokiData();
        resp.setData(data);

        LokiQueryResponse.LokiStream stream = new LokiQueryResponse.LokiStream();
        LokiQueryResponse.LokiStreamLabels labels = new LokiQueryResponse.LokiStreamLabels();
        labels.setJob("tech-iam");
        labels.setLevel("ERROR");
        stream.setStream(labels);

        long baseNanos = 1752624000_000_000_000L;
        List<List<String>> values = new ArrayList<>();
        values.add(List.of(String.valueOf(baseNanos), "ERROR login failed"));
        stream.setValues(values);

        List<LokiQueryResponse.LokiStream> streams = new ArrayList<>();
        streams.add(stream);
        data.setStreams(streams);
        return resp;
    }
}
