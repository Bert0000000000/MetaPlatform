package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.dto.*;
import com.metaplatform.dashboard.service.DashboardPageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 工作台页面 BFF 控制器
 * 路由：/api/v1/dashboard/page/*
 * 数据源：本服务数据库 dashboard_page_* 表（Flyway V4 维护）
 * 替代方案：Nacos 上游聚合（TECH-WFE / TECH-OBS）当前未部署，故直接读本地 DB
 */
@RestController
@RequestMapping("/api/v1/dashboard/page")
@RequiredArgsConstructor
public class DashboardPageController {

    private final DashboardPageService service;

    /** 健康检查 */
    @GetMapping("/health")
    public String health() {
        return "UP";
    }

    /** 顶部统计卡片 */
    @GetMapping("/stats")
    public List<DashboardPageStatDto> stats(@RequestParam(required = false) String userId) {
        return service.stats(userId);
    }

    /** 最近任务（全量，单用户场景下分页意义不大） */
    @GetMapping("/recent-tasks")
    public List<DashboardPageRecentTaskDto> recentTasks(@RequestParam(required = false) String userId) {
        return service.recentTasks(userId);
    }

    /** 系统健康 */
    @GetMapping("/system-health")
    public List<DashboardPageSystemHealthDto> systemHealth(@RequestParam(required = false) String userId) {
        return service.systemHealth(userId);
    }

    /** 活跃数字员工 */
    @GetMapping("/active-agents")
    public List<DashboardPageActiveAgentDto> activeAgents(@RequestParam(required = false) String userId) {
        return service.activeAgents(userId);
    }

    /** 快捷入口 */
    @GetMapping("/quick-links")
    public List<DashboardPageQuickLinkDto> quickLinks() {
        return List.of(
                new DashboardPageQuickLinkDto("superai", "SuperAI", "Sparkles", "/superai"),
                new DashboardPageQuickLinkDto("apps", "应用中心", "Boxes", "/apps"),
                new DashboardPageQuickLinkDto("agents", "数字员工", "Bot", "/agents"),
                new DashboardPageQuickLinkDto("knowledge", "知识库", "Database", "/knowledge"),
                new DashboardPageQuickLinkDto("mcp", "MCP 中心", "Plug", "/mcp"),
                new DashboardPageQuickLinkDto("ontology", "本体引擎", "GitBranch", "/ontology")
        );
    }

    /** 工作台聚合接口（一次拉全部，减少前端 waterfall） */
    @GetMapping("/summary")
    public DashboardPageSummaryDto summary(@RequestParam(required = false) String userId) {
        return service.summary(userId);
    }
}