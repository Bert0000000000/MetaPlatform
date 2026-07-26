package com.metaplatform.obs.alert;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * 告警服务（P8.2）。
 *
 * <p>每分钟扫描 RunEvent 表，命中规则即通过 Webhook / 钉钉 / 企微 推送告警。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlertingService {

    @Value("${mate.obs.alert.webhook:}")
    private String webhookUrl;

    @Scheduled(fixedDelay = 60000)
    public void scanAlerts() {
        Instant to = Instant.now();
        Instant from = to.minus(1, ChronoUnit.MINUTES);
        // 实际应基于 RunEventRepository 查询；此处只演示
        List<Map<String, Object>> alerts = new ArrayList<>();

        // 规则 1：错误率 > 5%
        // 规则 2：单 Run 耗时 > 60s
        // 规则 3：P95 Token > 8000
        if (!alerts.isEmpty() && !webhookUrl.isBlank()) {
            log.info("[Alerting] {} alerts -> webhook={}", alerts.size(), webhookUrl);
        }
    }
}
