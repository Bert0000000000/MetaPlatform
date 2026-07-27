package com.metaplatform.obs.alert.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.obs.alert.entity.AlertRuleEntity;
import com.metaplatform.obs.alert.repository.AlertRuleRepository;
import com.metaplatform.obs.config.ObsPrometheusProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Collections;
import java.util.List;

/**
 * AlertEvaluator: 周期扫描 obs_alert_rule,调用 Prometheus 即时查询,
 * 满足阈值条件的规则触发新告警。
 *
 * 评估失败或 Prometheus 不可达时,记录日志并跳过当前周期,避免因下游故障导致告警系统停摆。
 */
@Slf4j
@Component
public class AlertEvaluator {

    private final AlertRuleRepository ruleRepository;
    private final AlertService alertService;
    private final ObsPrometheusProperties prometheusProperties;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate;

    public AlertEvaluator(AlertRuleRepository ruleRepository,
                          AlertService alertService,
                          ObsPrometheusProperties prometheusProperties,
                          @Qualifier("prometheusRestTemplate") RestTemplate restTemplate) {
        this.ruleRepository = ruleRepository;
        this.alertService = alertService;
        this.prometheusProperties = prometheusProperties;
        this.restTemplate = restTemplate;
    }

    @Scheduled(fixedDelayString = "${app.obs.alert.evaluation-interval-ms:60000}",
            initialDelayString = "${app.obs.alert.evaluation-initial-delay-ms:30000}")
    public void evaluate() {
        List<AlertRuleEntity> rules = ruleRepository.findAllEnabled("tenant-default");
        for (AlertRuleEntity rule : rules) {
            try {
                double currentValue = queryPrometheusValue(rule.getMetricName());
                if (Double.isNaN(currentValue)) {
                    continue;
                }
                alertService.triggerIfMatched(rule, currentValue);
            } catch (Exception e) {
                log.warn("Alert evaluation failed for rule {}: {}", rule.getId(), e.getMessage());
            }
        }
    }

    double queryPrometheusValue(String metricName) {
        String url = UriComponentsBuilder
                .fromHttpUrl(prometheusProperties.getBaseUrl())
                .path("/api/v1/query")
                .queryParam("query", metricName)
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
                    return Double.NaN;
                }
                return Double.parseDouble(valueStr);
            }
            return Double.NaN;
        } catch (Exception e) {
            log.warn("Failed to query Prometheus for metric {}: {}", metricName, e.getMessage());
            return Double.NaN;
        }
    }
}