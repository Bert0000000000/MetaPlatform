package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.entity.MetricConfigEntity;
import com.metaplatform.dashboard.service.MetricConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard/metrics/config")
@RequiredArgsConstructor
public class MetricConfigController {

    private final MetricConfigService metricConfigService;

    @GetMapping
    public List<MetricConfigEntity> getConfig(@RequestParam String userId) {
        return metricConfigService.getConfig(userId);
    }

    @PostMapping
    public List<MetricConfigEntity> saveConfig(@RequestParam String userId,
                                               @RequestBody List<MetricConfigEntity> configs) {
        return metricConfigService.saveConfig(userId, configs);
    }

    // TODO: WebSocket 推流端点待实现（/ws/dashboard/metrics），用于实时推送指标更新。
    // 实现时需注册 WebSocketHandler，前端订阅后服务端定时推送 metrics 数据。
}
