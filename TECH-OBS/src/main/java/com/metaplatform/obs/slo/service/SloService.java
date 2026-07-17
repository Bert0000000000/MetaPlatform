package com.metaplatform.obs.slo.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.config.ObsPrometheusProperties;
import com.metaplatform.obs.exception.ObsException;
import com.metaplatform.obs.slo.dto.ErrorBudget;
import com.metaplatform.obs.slo.dto.SloReport;
import com.metaplatform.obs.slo.dto.SloRequest;
import com.metaplatform.obs.slo.entity.SloEntity;
import com.metaplatform.obs.slo.repository.SloRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SloService {

    private static final Set<String> VALID_SLI_TYPES = Set.of("AVAILABILITY", "LATENCY", "THROUGHPUT");
    private static final Set<String> VALID_WINDOWS = Set.of("7d", "30d", "90d");

    private final SloRepository sloRepository;
    private final ObsPrometheusProperties prometheusProperties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Qualifier("prometheusRestTemplate")
    private final RestTemplate restTemplate;

    public SloEntity create(SloRequest request) {
        validate(request);
        SloEntity entity = SloEntity.builder()
                .tenantId(TenantContext.get())
                .name(request.getName())
                .description(request.getDescription())
                .serviceName(request.getServiceName())
                .sliType(request.getSliType().toUpperCase())
                .sliQuery(request.getSliQuery())
                .target(request.getTarget())
                .window(request.getWindow() != null ? request.getWindow() : "30d")
                .errorBudgetTotal(calculateTotalBudget(request.getTarget()))
                .errorBudgetConsumed(0.0)
                .burnRate(0.0)
                .status("HEALTHY")
                .build();
        return sloRepository.insert(entity);
    }

    public SloEntity update(UUID id, SloRequest request) {
        validate(request);
        SloEntity existing = sloRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "SLO 不存在: " + id));
        existing.setName(request.getName());
        existing.setDescription(request.getDescription());
        existing.setServiceName(request.getServiceName());
        existing.setSliType(request.getSliType().toUpperCase());
        existing.setSliQuery(request.getSliQuery());
        existing.setTarget(request.getTarget());
        existing.setWindow(request.getWindow() != null ? request.getWindow() : "30d");
        existing.setErrorBudgetTotal(calculateTotalBudget(request.getTarget()));
        return sloRepository.update(existing);
    }

    public SloEntity get(UUID id) {
        return sloRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "SLO 不存在: " + id));
    }

    public List<SloEntity> list() {
        return sloRepository.findAll(TenantContext.get());
    }

    public void delete(UUID id) {
        SloEntity existing = sloRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "SLO 不存在: " + id));
        int rows = sloRepository.softDelete(existing.getId());
        if (rows == 0) {
            throw new ObsException(ErrorCode.INTERNAL_ERROR, "删除 SLO 失败");
        }
    }

    public ErrorBudget getErrorBudget(UUID id) {
        SloEntity slo = get(id);
        double total = slo.getErrorBudgetTotal() != null
                ? slo.getErrorBudgetTotal()
                : calculateTotalBudget(slo.getTarget());
        double remaining = Math.max(total - slo.getErrorBudgetConsumed(), 0.0);
        return ErrorBudget.builder()
                .target(slo.getTarget())
                .totalBudget(total)
                .consumedBudget(slo.getErrorBudgetConsumed())
                .remainingBudget(remaining)
                .burnRate(slo.getBurnRate())
                .status(slo.getStatus())
                .window(slo.getWindow())
                .build();
    }

    public SloReport generateReport(UUID id, String period) {
        SloEntity slo = get(id);
        String effectivePeriod = period != null && !period.isBlank() ? period : slo.getWindow();
        if (!VALID_WINDOWS.contains(effectivePeriod)) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE,
                    "period 必须是 7d/30d/90d 之一");
        }

        double actualAvailability = queryActualAvailability(slo, effectivePeriod);
        double consumed = computeConsumedBudget(slo.getTarget(), actualAvailability, effectivePeriod);
        double burnRate = computeBurnRate(consumed, slo.getErrorBudgetTotal(), effectivePeriod);
        String status = deriveStatus(slo.getTarget(), actualAvailability, burnRate);

        // persist updated consumption if changed
        if (Math.abs(consumed - slo.getErrorBudgetConsumed()) > 0.0001) {
            slo.setErrorBudgetConsumed(consumed);
            slo.setBurnRate(burnRate);
            slo.setStatus(status);
            sloRepository.update(slo);
        }

        return SloReport.builder()
                .sloId(slo.getId().toString())
                .name(slo.getName())
                .serviceName(slo.getServiceName())
                .period(effectivePeriod)
                .target(slo.getTarget())
                .actualAvailability(actualAvailability)
                .errorBudget(getErrorBudget(slo.getId()))
                .status(status)
                .generatedAt(Instant.now())
                .summary(buildSummary(slo, actualAvailability, consumed, burnRate, status))
                .build();
    }

    double calculateTotalBudget(double target) {
        // 错误预算 = (100 - target)%
        return Math.max(100.0 - target, 0.0);
    }

    double computeConsumedBudget(double target, double actualAvailability, String period) {
        if (actualAvailability <= 0.0) {
            return 100.0;
        }
        if (actualAvailability >= target) {
            return 0.0;
        }
        double allowedFailure = Math.max(100.0 - target, 0.0);
        if (allowedFailure == 0.0) {
            return 100.0;
        }
        double actualFailure = Math.max(100.0 - actualAvailability, 0.0);
        return Math.min(actualFailure / allowedFailure * 100.0, 100.0);
    }

    double computeBurnRate(double consumedPercent, Double totalBudget, String period) {
        if (totalBudget == null || totalBudget <= 0.0) {
            return 0.0;
        }
        long days = windowDays(period);
        if (days <= 0) {
            return 0.0;
        }
        return consumedPercent / (double) days;
    }

    String deriveStatus(double target, double actualAvailability, double burnRate) {
        if (actualAvailability < target * 0.9) {
            return "EXHAUSTED";
        }
        if (burnRate > 1.0 || actualAvailability < target) {
            return "AT_RISK";
        }
        return "HEALTHY";
    }

    long windowDays(String period) {
        if (period == null) return 30;
        return switch (period) {
            case "7d" -> 7;
            case "30d" -> 30;
            case "90d" -> 90;
            default -> 30;
        };
    }

    private String buildSummary(SloEntity slo, double actual, double consumed, double burnRate, String status) {
        return String.format(
                "SLO [%s] 服务 %s 周期 %s:目标 %.2f%%,实际可用率 %.2f%%,已消耗预算 %.2f%%,燃烧率 %.2f%%/d,状态 %s",
                slo.getName(), slo.getServiceName(), slo.getWindow(),
                slo.getTarget(), actual, consumed, burnRate, status);
    }

    double queryActualAvailability(SloEntity slo, String period) {
        String query;
        if ("AVAILABILITY".equalsIgnoreCase(slo.getSliType())) {
            query = slo.getSliQuery();
        } else {
            // LATENCY/THROUGHPUT 视作可用率代理,沿用 sli_query
            query = slo.getSliQuery();
        }
        String url = UriComponentsBuilder
                .fromHttpUrl(prometheusProperties.getBaseUrl())
                .path("/api/v1/query")
                .queryParam("query", query)
                .build()
                .toUriString();
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode data = root.path("data").path("result");
            if (data.isArray() && data.size() > 0) {
                String valueStr = data.get(0).path("value").get(1).asText("NaN");
                if ("NaN".equalsIgnoreCase(valueStr)) {
                    return slo.getTarget();
                }
                double raw = Double.parseDouble(valueStr);
                return raw * 100.0; // assume 0~1 ratio -> percent
            }
            return slo.getTarget();
        } catch (Exception e) {
            log.warn("Failed to query Prometheus for SLO {}: {}", slo.getId(), e.getMessage());
            return slo.getTarget();
        }
    }

    private void validate(SloRequest request) {
        if (request == null) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "请求体不能为空");
        }
        if (request.getServiceName() == null || request.getServiceName().isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "serviceName 不能为空");
        }
        if (request.getSliType() == null || !VALID_SLI_TYPES.contains(request.getSliType().toUpperCase())) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE,
                    "sliType 必须是 AVAILABILITY/LATENCY/THROUGHPUT 之一");
        }
        if (request.getSliQuery() == null || request.getSliQuery().isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "sliQuery 不能为空");
        }
        if (request.getWindow() != null && !VALID_WINDOWS.contains(request.getWindow())) {
            throw new ObsException(ErrorCode.INVALID_FIELD_VALUE,
                    "window 必须是 7d/30d/90d 之一");
        }
    }
}