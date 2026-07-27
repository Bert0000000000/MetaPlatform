package com.metaplatform.obs.service;

import com.metaplatform.obs.dto.DashboardMetricCard;
import com.metaplatform.obs.dto.DashboardTrendPoint;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
public class DashboardMetricService {

    public List<DashboardMetricCard> getCards() {
        return List.of(
                DashboardMetricCard.builder()
                        .key("users")
                        .label("在线用户")
                        .value(42)
                        .unit("人")
                        .trend(12)
                        .trendUp(true)
                        .icon("team")
                        .build(),
                DashboardMetricCard.builder()
                        .key("workflows")
                        .label("运行中流程")
                        .value(18)
                        .unit("个")
                        .trend(5)
                        .trendUp(true)
                        .icon("workflow")
                        .build(),
                DashboardMetricCard.builder()
                        .key("apis")
                        .label("API 调用")
                        .value(12580)
                        .unit("次")
                        .trend(8)
                        .trendUp(true)
                        .icon("api")
                        .build(),
                DashboardMetricCard.builder()
                        .key("errors")
                        .label("错误率")
                        .value(0.3)
                        .unit("%")
                        .trend(2)
                        .trendUp(false)
                        .icon("error")
                        .build()
        );
    }

    public List<DashboardTrendPoint> getTrend(String range) {
        int points = switch (range) {
            case "1h" -> 12;
            case "7d" -> 14;
            case "30d" -> 15;
            default -> 12;
        };
        long stepMinutes = switch (range) {
            case "1h" -> 5;
            case "7d" -> 720;
            case "30d" -> 2880;
            default -> 120;
        };

        List<DashboardTrendPoint> result = new ArrayList<>(points);
        Instant now = Instant.now();
        for (int i = 0; i < points; i++) {
            Instant time = now.minus((long) (points - i) * stepMinutes, ChronoUnit.MINUTES);
            result.add(DashboardTrendPoint.builder()
                    .time(time.toString())
                    .value(Math.round(1000 + Math.random() * 2000))
                    .apiCalls(Math.round(800 + Math.random() * 1500))
                    .errors(Math.round(Math.random() * 20))
                    .build());
        }
        return result;
    }
}
