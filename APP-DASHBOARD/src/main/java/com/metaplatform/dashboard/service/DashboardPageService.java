package com.metaplatform.dashboard.service;

import com.metaplatform.dashboard.dto.*;
import com.metaplatform.dashboard.entity.*;
import com.metaplatform.dashboard.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 工作台页面数据聚合服务
 * 数据来源：本服务数据库 dashboard_page_* 表（Flyway V4 维护）
 */
@Service
@RequiredArgsConstructor
public class DashboardPageService {

    private static final String DEFAULT_USER_ID = "u-001";

    private final DashboardPageStatRepository statRepository;
    private final DashboardPageRecentTaskRepository recentTaskRepository;
    private final DashboardPageSystemHealthRepository systemHealthRepository;
    private final DashboardPageActiveAgentRepository activeAgentRepository;

    public List<DashboardPageStatDto> stats(String userId) {
        String uid = userId == null || userId.isBlank() ? DEFAULT_USER_ID : userId;
        return statRepository.findByUserIdOrderBySortOrderAsc(uid).stream()
                .map(e -> new DashboardPageStatDto(e.getLabel(), e.getValue(),
                        e.getTrendLabel(), e.getTrendValue(), e.getTrendUp(), e.getIcon()))
                .toList();
    }

    public List<DashboardPageRecentTaskDto> recentTasks(String userId) {
        String uid = userId == null || userId.isBlank() ? DEFAULT_USER_ID : userId;
        return recentTaskRepository.findByUserIdOrderBySortOrderAsc(uid).stream()
                .map(e -> new DashboardPageRecentTaskDto(e.getName(), e.getTypeLabel(),
                        e.getTypeClass(), e.getAgent(), e.getStatus(), e.getStatusClass(), e.getTime()))
                .toList();
    }

    public List<DashboardPageSystemHealthDto> systemHealth(String userId) {
        String uid = userId == null || userId.isBlank() ? DEFAULT_USER_ID : userId;
        return systemHealthRepository.findByUserIdOrderBySortOrderAsc(uid).stream()
                .map(e -> new DashboardPageSystemHealthDto(e.getDotClass(), e.getName(),
                        e.getDetail(), e.getStatus()))
                .toList();
    }

    public List<DashboardPageActiveAgentDto> activeAgents(String userId) {
        String uid = userId == null || userId.isBlank() ? DEFAULT_USER_ID : userId;
        return activeAgentRepository.findByUserIdOrderBySortOrderAsc(uid).stream()
                .map(e -> new DashboardPageActiveAgentDto(e.getDotClass(), e.getName(),
                        e.getType(), e.getTasks(), e.getStatusBg(), e.getStatusColor(), e.getStatusLabel()))
                .toList();
    }

    /**
     * 聚合响应：一次返回工作台页面所需的全部数据。
     * 同步方法（不复用 WebClient Mono）—— 4 个表均为本地 JPA 查询，
     * 串行执行总开销 < 10ms，比 WebClient Mono.zip 更直接。
     */
    @Transactional(readOnly = true)
    public DashboardPageSummaryDto summary(String userId) {
        String uid = userId == null || userId.isBlank() ? DEFAULT_USER_ID : userId;
        List<DashboardPageRecentTaskDto> tasks = recentTasks(uid);
        return new DashboardPageSummaryDto(
                stats(uid),
                tasks,
                tasks.size(),
                systemHealth(uid),
                activeAgents(uid),
                defaultQuickLinks()
        );
    }

    private List<DashboardPageQuickLinkDto> defaultQuickLinks() {
        return List.of(
                new DashboardPageQuickLinkDto("superai", "SuperAI", "Sparkles", "/superai"),
                new DashboardPageQuickLinkDto("apps", "应用中心", "Boxes", "/apps"),
                new DashboardPageQuickLinkDto("agents", "数字员工", "Bot", "/agents"),
                new DashboardPageQuickLinkDto("knowledge", "知识库", "Database", "/knowledge"),
                new DashboardPageQuickLinkDto("mcp", "MCP 中心", "Plug", "/mcp"),
                new DashboardPageQuickLinkDto("ontology", "本体引擎", "GitBranch", "/ontology")
        );
    }
}