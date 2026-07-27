package com.metaplatform.obs.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.config.ObsPrometheusProperties;
import com.metaplatform.obs.dto.MetricInfo;
import com.metaplatform.obs.dto.MetricQueryRequest;
import com.metaplatform.obs.dto.MetricQueryResponse;
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

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class MetricService {

    private final RestTemplate restTemplate;
    private final ObsPrometheusProperties prometheusProperties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MetricService(@Qualifier("lokiRestTemplate") RestTemplate restTemplate,
                         ObsPrometheusProperties prometheusProperties) {
        this.restTemplate = restTemplate;
        this.prometheusProperties = prometheusProperties;
    }

    /**
     * 列出所有可用指标
     */
    public List<MetricInfo> listMetrics() {
        String url = UriComponentsBuilder
                .fromHttpUrl(prometheusProperties.getBaseUrl())
                .path("/api/v1/label/__name__/values")
                .build()
                .toUriString();

        JsonNode root = executePrometheusGet(url);
        List<MetricInfo> result = new ArrayList<>();
        JsonNode data = root.path("data");
        if (data.isArray()) {
            for (JsonNode name : data) {
                result.add(MetricInfo.builder()
                        .name(name.asText())
                        .type("unknown")
                        .help("")
                        .build());
            }
        }
        return result;
    }

    /**
     * 获取指标元数据
     */
    public MetricInfo getMetricMetadata(String metricName) {
        String url = UriComponentsBuilder
                .fromHttpUrl(prometheusProperties.getBaseUrl())
                .path("/api/v1/metadata")
                .queryParam("metric", metricName)
                .build()
                .toUriString();

        JsonNode root = executePrometheusGet(url);
        JsonNode metricData = root.path("data").path(metricName);
        if (metricData.isArray() && metricData.size() > 0) {
            JsonNode meta = metricData.get(0);
            return MetricInfo.builder()
                    .name(metricName)
                    .type(meta.path("type").asText("unknown"))
                    .help(meta.path("help").asText(""))
                    .build();
        }
        return MetricInfo.builder()
                .name(metricName)
                .type("unknown")
                .help("")
                .build();
    }

    /**
     * 查询指标数据（range query）
     */
    public MetricQueryResponse queryMetrics(MetricQueryRequest request) {
        String promql = buildPromql(request.getMetricName(), request.getLabels());
        long start = toEpochSeconds(request.getStartTime());
        long end = toEpochSeconds(request.getEndTime());

        String url = UriComponentsBuilder
                .fromHttpUrl(prometheusProperties.getBaseUrl())
                .path("/api/v1/query_range")
                .queryParam("query", promql)
                .queryParam("start", String.valueOf(start))
                .queryParam("end", String.valueOf(end))
                .queryParam("step", request.getStep())
                .build()
                .toUriString();

        JsonNode root = executePrometheusGet(url);
        return parseQueryRangeResponse(root, request.getMetricName());
    }

    String buildPromql(String metricName, Map<String, String> labels) {
        StringBuilder promql = new StringBuilder(metricName);
        if (labels != null && !labels.isEmpty()) {
            promql.append("{");
            boolean first = true;
            for (Map.Entry<String, String> entry : labels.entrySet()) {
                if (!first) promql.append(",");
                promql.append(entry.getKey()).append("=\"").append(entry.getValue()).append("\"");
                first = false;
            }
            promql.append("}");
        }
        return promql.toString();
    }

    private MetricQueryResponse parseQueryRangeResponse(JsonNode root, String metricName) {
        JsonNode resultNode = root.path("data").path("result");
        List<MetricQueryResponse.MetricTimeSeries> series = new ArrayList<>();

        if (resultNode.isArray()) {
            for (JsonNode seriesNode : resultNode) {
                Map<String, String> labels = Collections.emptyMap();
                JsonNode metric = seriesNode.path("metric");
                if (metric.isObject()) {
                    labels = objectMapper.convertValue(metric,
                            objectMapper.getTypeFactory().constructMapType(Map.class, String.class, String.class));
                }

                List<MetricQueryResponse.MetricValue> values = new ArrayList<>();
                JsonNode valuesNode = seriesNode.path("values");
                if (valuesNode.isArray()) {
                    for (JsonNode val : valuesNode) {
                        if (val.isArray() && val.size() >= 2) {
                            long ts = (long) val.get(0).asDouble();
                            double v = parseDoubleSafe(val.get(1).asText());
                            values.add(MetricQueryResponse.MetricValue.builder()
                                    .timestamp(ts)
                                    .value(v)
                                    .build());
                        }
                    }
                }
                series.add(MetricQueryResponse.MetricTimeSeries.builder()
                        .labels(labels)
                        .values(values)
                        .build());
            }
        }

        return MetricQueryResponse.builder()
                .metricName(metricName)
                .results(series)
                .build();
    }

    private JsonNode executePrometheusGet(String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            return objectMapper.readTree(response.getBody());
        } catch (ResourceAccessException e) {
            throw new ObsException(ErrorCode.SERVICE_UNAVAILABLE,
                    "无法访问 Prometheus: " + e.getMessage());
        } catch (HttpStatusCodeException e) {
            throw new ObsException(ErrorCode.SERVICE_UNAVAILABLE,
                    "Prometheus 返回错误: " + e.getStatusCode());
        } catch (Exception e) {
            throw new ObsException(ErrorCode.INTERNAL_ERROR,
                    "解析 Prometheus 响应失败: " + e.getMessage());
        }
    }

    private long toEpochSeconds(OffsetDateTime time) {
        return time.toInstant().getEpochSecond();
    }

    private double parseDoubleSafe(String value) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}
