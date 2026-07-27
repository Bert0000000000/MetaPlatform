package com.metaplatform.obs.service;

import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.config.ObsLokiProperties;
import com.metaplatform.obs.config.ObsQueryProperties;
import com.metaplatform.obs.dto.LogSearchRequest;
import com.metaplatform.obs.dto.LogSearchResponse;
import com.metaplatform.obs.dto.RegexSearchRequest;
import com.metaplatform.obs.dto.loki.LokiQueryResponse;
import com.metaplatform.obs.exception.ObsException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Slf4j
@Service
public class LogSearchService {

    private final RestTemplate restTemplate;
    private final ObsLokiProperties lokiProperties;
    private final ObsQueryProperties queryProperties;

    public LogSearchService(@Qualifier("lokiRestTemplate") RestTemplate restTemplate,
                            ObsLokiProperties lokiProperties,
                            ObsQueryProperties queryProperties) {
        this.restTemplate = restTemplate;
        this.lokiProperties = lokiProperties;
        this.queryProperties = queryProperties;
    }

    public LogSearchResponse search(LogSearchRequest request) {
        validateTimeRange(request.getStartTime(), request.getEndTime());

        String logql = buildKeywordLogql(request.getService(), request.getKeyword(), request.getLevel());
        LokiQueryResponse lokiResp = executeLokiQuery(logql,
                request.getStartTime(), request.getEndTime(),
                request.getPage(), request.getSize());

        List<LogSearchResponse.LogSearchResult> results = parseAndHighlight(lokiResp, request.getKeyword(), null);
        return buildResponse(results, request.getPage(), request.getSize());
    }

    public LogSearchResponse searchRegex(RegexSearchRequest request) {
        validateTimeRange(request.getStartTime(), request.getEndTime());

        Pattern compiled;
        try {
            compiled = Pattern.compile(request.getPattern());
        } catch (PatternSyntaxException e) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE, "正则表达式不合法: " + e.getMessage());
        }

        String logql = buildRegexLogql(request.getService(), request.getPattern(), request.getLevel());
        LokiQueryResponse lokiResp = executeLokiQuery(logql,
                request.getStartTime(), request.getEndTime(),
                request.getPage(), request.getSize());

        List<LogSearchResponse.LogSearchResult> results = parseAndHighlight(lokiResp, null, compiled);
        return buildResponse(results, request.getPage(), request.getSize());
    }

    public String buildKeywordLogql(String service, String keyword, String level) {
        String selector = buildJobSelector(service);
        StringBuilder logql = new StringBuilder(selector).append(" |= \"")
                .append(escapeLogqlValue(keyword)).append("\"");
        appendLevelFilter(logql, level);
        return logql.toString();
    }

    public String buildRegexLogql(String service, String pattern, String level) {
        String selector = buildJobSelector(service);
        StringBuilder logql = new StringBuilder(selector).append(" |~ \"")
                .append(escapeLogqlValue(pattern)).append("\"");
        appendLevelFilter(logql, level);
        return logql.toString();
    }

    private String buildJobSelector(String service) {
        if (service == null || service.isBlank()) {
            return "{job=~\".+\"}";
        }
        return "{job=\"" + escapeLogqlValue(service) + "\"}";
    }

    private void appendLevelFilter(StringBuilder logql, String level) {
        if (level != null && !level.isBlank()) {
            logql.append(" | json | level = \"").append(escapeLogqlValue(level)).append("\"");
        }
    }

    private String escapeLogqlValue(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private LokiQueryResponse executeLokiQuery(String logql, OffsetDateTime startTime, OffsetDateTime endTime,
                                               Integer page, Integer size) {
        long startNanos = toEpochNanos(startTime);
        long endNanos = toEpochNanos(endTime);

        int effectivePage = page == null ? 1 : page;
        int effectiveSize = size == null
                ? queryProperties.getDefaultPageSize()
                : Math.min(size, queryProperties.getMaxPageSize());
        long offset = (long) (effectivePage - 1) * effectiveSize;
        long limit = (long) effectiveSize + offset;

        String fullUrl = UriComponentsBuilder
                .fromHttpUrl(lokiProperties.getBaseUrl())
                .path(lokiProperties.getQueryPath())
                .queryParam("query", logql)
                .queryParam("start", String.valueOf(startNanos))
                .queryParam("end", String.valueOf(endNanos))
                .queryParam("limit", String.valueOf(limit))
                .queryParam("direction", "backward")
                .build()
                .encode()
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        try {
            ResponseEntity<LokiQueryResponse> response = restTemplate.exchange(
                    fullUrl, HttpMethod.GET, new HttpEntity<>(headers), LokiQueryResponse.class);

            LokiQueryResponse body = response.getBody();
            if (body == null || !"success".equalsIgnoreCase(body.getStatus())) {
                String errMsg = body != null ? body.getError() : "Loki 返回空响应";
                throw new ObsException(ErrorCode.LOKI_UNAVAILABLE,
                        "Loki 搜索失败: " + (errMsg != null ? errMsg : "未知错误"));
            }
            return body;
        } catch (ResourceAccessException e) {
            throw new ObsException(ErrorCode.LOKI_UNAVAILABLE, "无法访问 Loki: " + e.getMessage());
        } catch (HttpStatusCodeException e) {
            throw new ObsException(ErrorCode.LOKI_UNAVAILABLE,
                    "Loki 返回错误状态: " + e.getStatusCode() + " body=" + e.getResponseBodyAsString());
        }
    }

    private List<LogSearchResponse.LogSearchResult> parseAndHighlight(LokiQueryResponse response,
                                                                       String keyword, Pattern regexPattern) {
        if (response.getData() == null || response.getData().getStreams() == null) {
            return Collections.emptyList();
        }
        List<LogSearchResponse.LogSearchResult> results = new ArrayList<>();
        for (LokiQueryResponse.LokiStream stream : response.getData().getStreams()) {
            String service = null;
            String level = null;
            if (stream.getStream() != null) {
                if (stream.getStream().getJob() != null) {
                    service = stream.getStream().getJob();
                } else if (stream.getStream().getService() != null) {
                    service = stream.getStream().getService();
                }
                if (stream.getStream().getLevel() != null) {
                    level = stream.getStream().getLevel();
                }
            }
            if (stream.getValues() == null) continue;
            for (List<String> entry : stream.getValues()) {
                if (entry.size() < 2) continue;
                long tsMillis = parseTimestampMillis(entry.get(0));
                String line = entry.get(1);
                List<LogSearchResponse.Highlight> highlights = regexPattern != null
                        ? computeRegexHighlights(line, regexPattern)
                        : computeKeywordHighlights(line, keyword);
                results.add(LogSearchResponse.LogSearchResult.builder()
                        .timestamp(Instant.ofEpochMilli(tsMillis))
                        .service(service)
                        .level(level)
                        .message(line)
                        .highlights(highlights)
                        .build());
            }
        }
        return results;
    }

    private List<LogSearchResponse.Highlight> computeKeywordHighlights(String message, String keyword) {
        List<LogSearchResponse.Highlight> highlights = new ArrayList<>();
        if (keyword == null || keyword.isBlank() || message == null) {
            return highlights;
        }
        int idx = 0;
        while ((idx = message.indexOf(keyword, idx)) != -1) {
            highlights.add(LogSearchResponse.Highlight.builder()
                    .start(idx)
                    .end(idx + keyword.length())
                    .text(keyword)
                    .build());
            idx += keyword.length();
        }
        return highlights;
    }

    private List<LogSearchResponse.Highlight> computeRegexHighlights(String message, Pattern pattern) {
        List<LogSearchResponse.Highlight> highlights = new ArrayList<>();
        if (message == null || pattern == null) {
            return highlights;
        }
        Matcher matcher = pattern.matcher(message);
        while (matcher.find()) {
            highlights.add(LogSearchResponse.Highlight.builder()
                    .start(matcher.start())
                    .end(matcher.end())
                    .text(matcher.group())
                    .build());
        }
        return highlights;
    }

    private LogSearchResponse buildResponse(List<LogSearchResponse.LogSearchResult> all, Integer page, Integer size) {
        int effectivePage = page == null ? 1 : page;
        int effectiveSize = size == null
                ? queryProperties.getDefaultPageSize()
                : Math.min(size, queryProperties.getMaxPageSize());

        long total = all.size();
        long offset = (long) (effectivePage - 1) * effectiveSize;
        int from = (int) Math.min(offset, all.size());
        int to = (int) Math.min(offset + effectiveSize, all.size());
        List<LogSearchResponse.LogSearchResult> pageItems = from >= to
                ? Collections.emptyList()
                : new ArrayList<>(all.subList(from, to));
        long totalPages = total == 0 ? 0 : (total + effectiveSize - 1) / effectiveSize;

        return LogSearchResponse.builder()
                .total(total)
                .page(effectivePage)
                .pageSize(effectiveSize)
                .totalPages(totalPages)
                .results(pageItems)
                .build();
    }

    private void validateTimeRange(OffsetDateTime startTime, OffsetDateTime endTime) {
        if (startTime == null || endTime == null) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "startTime 与 endTime 不能为空");
        }
        if (startTime.isAfter(endTime)) {
            throw new ObsException(ErrorCode.INVALID_TIME_RANGE, "startTime 必须早于 endTime");
        }
        Duration range = Duration.between(startTime, endTime);
        if (range.toHours() > queryProperties.getMaxTimeRangeHours()) {
            throw new ObsException(ErrorCode.INVALID_TIME_RANGE,
                    "时间范围超出最大允许 " + queryProperties.getMaxTimeRangeHours() + " 小时");
        }
    }

    private long toEpochNanos(OffsetDateTime time) {
        return time.toInstant().toEpochMilli() * 1_000_000L;
    }

    private long parseTimestampMillis(String tsRaw) {
        try {
            return Long.parseLong(tsRaw) / 1_000_000L;
        } catch (NumberFormatException e) {
            return System.currentTimeMillis();
        }
    }
}
