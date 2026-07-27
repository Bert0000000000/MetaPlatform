package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.dto.DashboardPageDeliverableSummaryDto;
import com.metaplatform.dashboard.dto.DashboardPageDeliverableTimelineDto;
import com.metaplatform.dashboard.dto.DashboardPageMyDeliverableDto;
import com.metaplatform.dashboard.entity.DeliverableEntity;
import com.metaplatform.dashboard.repository.DashboardPageDeliverableTimelineRepository;
import com.metaplatform.dashboard.repository.DeliverableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/dashboard/deliverables")
@RequiredArgsConstructor
public class DeliverablesController {
    private final DeliverableRepository deliverableRepository;
    private final DashboardPageDeliverableTimelineRepository timelineRepository;

    @GetMapping("/summary")
    public DashboardPageDeliverableSummaryDto summary(@RequestParam(required = false) String userId) {
        String uid = userId == null || userId.isBlank() ? "u-001" : userId;
        List<DashboardPageMyDeliverableDto> ds = deliverableRepository.findAll().stream()
                .filter(e -> uid.equals(e.getUserId()))
                .filter(e -> !"DELETED".equals(e.getStatus()))
                .map(this::toDto)
                .toList();
        List<DashboardPageDeliverableTimelineDto> tl = timelineRepository
                .findByUserIdOrderBySortOrderAsc(uid).stream()
                .map(e -> new DashboardPageDeliverableTimelineDto(
                        e.getTimeLabel(), e.getTitle(), e.getDescription(), e.getIcon()))
                .toList();
        return new DashboardPageDeliverableSummaryDto(ds, tl);
    }

    private DashboardPageMyDeliverableDto toDto(DeliverableEntity e) {
        // type → 中文标签
        Map<String, String> typeLabelMap = Map.of(
                "REPORT", "报告", "DATASET", "数据集", "MODEL", "模型", "DOCUMENT", "文档");
        Map<String, String> typeClassMap = Map.of(
                "REPORT", "v-badge-neutral", "DATASET", "v-badge-info",
                "MODEL", "v-badge-warning", "DOCUMENT", "v-badge-neutral");
        // source_type (AI_GENERATED vs MANUAL_UPLOADED) → genClass
        String genClass = "AI_GENERATED".equals(e.getSourceType()) ? "ai" : "human";
        // source_id → genName（简单 fallback：去掉 -bot 后缀）
        String genName = e.getSourceId();
        if (genName != null && genName.endsWith("-bot")) {
            genName = genName.substring(0, genName.length() - 4);
        }
        // status → 中文
        String statusLabel = switch (e.getStatus()) {
            case "ACTIVE" -> "已发布";
            default -> e.getStatus();
        };
        // date
        String dateStr = e.getCreatedAt() != null
                ? e.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                : "";
        return new DashboardPageMyDeliverableDto(
                e.getTitle(),
                typeLabelMap.getOrDefault(e.getType(), e.getType()),
                typeClassMap.getOrDefault(e.getType(), "v-badge-neutral"),
                e.getDescription() != null ? e.getDescription() : "",
                genClass,
                genName,
                "-",
                "-",
                dateStr,
                statusLabel,
                "v-badge-success",
                "FileText");
    }
}