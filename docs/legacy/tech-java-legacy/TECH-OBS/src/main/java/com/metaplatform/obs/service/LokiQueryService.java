package com.metaplatform.obs.service;

import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.config.ObsLokiProperties;
import com.metaplatform.obs.config.ObsQueryProperties;
import com.metaplatform.obs.dto.LogEntry;
import com.metaplatform.obs.dto.LogQueryRequest;
import com.metaplatform.obs.dto.PageResponse;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class LokiQueryService {

    private final RestTemplate restTemplate;
    private final ObsLokiProperties lokiProperties;
    private final ObsQueryProperties queryProperties;

    public LokiQueryService(@Qualifier("lokiRestTemplate") RestTemplate restTemplate,
                            ObsLokiProperties lokiProperties,
                            ObsQueryProperties queryProperties) {
        this.restTemplate = restTemplate;
        this.lokiProperties = lokiProperties;
        this.queryProperties = queryProperties;
    }

    public PageResponse<LogEntry> query(LogQueryRequest request) {
        validateRequest(request);

        long startNanos = toEpochNanos(request.getStartTime());
        long endNanos = toEpochNanos(request.getEndTime());

        int page = request.getPage() == null ? 1 : request.getPage();
        int size = request.getSize() == null
                ? queryProperties.getDefaultPageSize()
                : Math.min(request.getSize(), queryProperties.getMaxPageSize());
        long offset = (long) (page - 1) * size;
        long limit = (long) size + offset;

        String logqlSelector = buildLogqlLabelSelector(request);
        String pipeline = buildLogqlPipeline(request);
        String logql = "{" + logqlSelector + "}" + pipeline;

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
                        "Loki 查询失败: " + (errMsg != null ? errMsg : "未知错误"));
            }
            List<LogEntry> entries = parseEntries(body);
            long total = entries.size();
            List<LogEntry> pageItems = paginate(entries, offset, size);
            long totalPages = total == 0 ? 0 : (total + size - 1) / size;

            return PageResponse.<LogEntry>builder()
                    .items(pageItems)
                    .total(total)
                    .page(page)
                    .pageSize(size)
                    .totalPages(totalPages)
                    .build();
        } catch (ResourceAccessException e) {
            throw new ObsException(ErrorCode.LOKI_UNAVAILABLE, "无法访问 Loki: " + e.getMessage());
        } catch (HttpStatusCodeException e) {
            throw new ObsException(ErrorCode.LOKI_UNAVAILABLE,
                    "Loki 返回错误状态: " + e.getStatusCode() + " body=" + e.getResponseBodyAsString());
        }
    }

    public String buildLogqlLabelSelector(LogQueryRequest request) {
        StringBuilder sb = new StringBuilder();
        if (request.getServiceName() != null && !request.getServiceName().isBlank()) {
            sb.append("service=\"").append(escapeLogqlValue(request.getServiceName())).append("\"");
        }
        if (request.getLevel() != null && !request.getLevel().isBlank()) {
            if (sb.length() > 0) sb.append(",");
            sb.append("level=\"").append(escapeLogqlValue(request.getLevel())).append("\"");
        }
        if (request.getTraceId() != null && !request.getTraceId().isBlank()) {
            if (sb.length() > 0) sb.append(",");
            sb.append("trace_id=\"").append(escapeLogqlValue(request.getTraceId())).append("\"");
        }
        return sb.toString();
    }

    public String buildLogqlPipeline(LogQueryRequest request) {
        if (request.getKeyword() == null || request.getKeyword().isBlank()) {
            return "";
        }
        return " |= \"" + escapeLogqlValue(request.getKeyword()) + "\"";
    }

    private String escapeLogqlValue(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private long toEpochNanos(OffsetDateTime time) {
        return time.toInstant().toEpochMilli() * 1_000_000L;
    }

    private void validateRequest(LogQueryRequest request) {
        if (request.getStartTime() == null || request.getEndTime() == null) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "startTime 与 endTime 不能为空");
        }
        if (request.getStartTime().isAfter(request.getEndTime())) {
            throw new ObsException(ErrorCode.INVALID_TIME_RANGE, "startTime 必须早于 endTime");
        }
        Duration range = Duration.between(request.getStartTime(), request.getEndTime());
        if (range.toHours() > queryProperties.getMaxTimeRangeHours()) {
            throw new ObsException(ErrorCode.INVALID_TIME_RANGE,
                    "时间范围超出最大允许 " + queryProperties.getMaxTimeRangeHours() + " 小时");
        }
    }

    private List<LogEntry> parseEntries(LokiQueryResponse response) {
        if (response.getData() == null || response.getData().getStreams() == null) {
            return Collections.emptyList();
        }
        List<LogEntry> entries = new ArrayList<>();
        for (LokiQueryResponse.LokiStream stream : response.getData().getStreams()) {
            Map<String, String> labels = new HashMap<>();
            if (stream.getStream() != null) {
                if (stream.getStream().getService() != null) labels.put("service", stream.getStream().getService());
                if (stream.getStream().getLevel() != null) labels.put("level", stream.getStream().getLevel());
            }
            if (stream.getValues() == null) continue;
            for (List<String> entry : stream.getValues()) {
                if (entry.size() < 2) continue;
                String tsRaw = entry.get(0);
                String line = entry.get(1);
                long tsMillis = parseTimestampMillis(tsRaw);
                Map<String, String> entryLabels = new HashMap<>(labels);
                LogEntry.LogEntryBuilder builder = LogEntry.builder()
                        .timestamp(Instant.ofEpochMilli(tsMillis))
                        .message(line)
                        .labels(entryLabels);
                String service = entryLabels.get("service");
                if (service != null) builder.serviceName(service);
                String level = entryLabels.get("level");
                if (level != null) builder.level(level);
                entries.add(builder.build());
            }
        }
        return entries;
    }

    private long parseTimestampMillis(String tsRaw) {
        try {
            return Long.parseLong(tsRaw) / 1_000_000L;
        } catch (NumberFormatException e) {
            return System.currentTimeMillis();
        }
    }

    private List<LogEntry> paginate(List<LogEntry> all, long offset, int size) {
        if (all.isEmpty()) return Collections.emptyList();
        int from = (int) Math.min(offset, all.size());
        int to = (int) Math.min(offset + size, all.size());
        if (from >= to) return Collections.emptyList();
        return new ArrayList<>(all.subList(from, to));
    }
}
