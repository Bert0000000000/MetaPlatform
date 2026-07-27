package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.dto.DashboardPageAgentExecLogDto;
import com.metaplatform.dashboard.dto.DashboardPageMyAgentDto;
import com.metaplatform.dashboard.repository.DashboardPageAgentExecLogRepository;
import com.metaplatform.dashboard.repository.DashboardPageMyAgentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard/myagents")
@RequiredArgsConstructor
public class MyAgentsController {
    private final DashboardPageMyAgentRepository agentRepository;
    private final DashboardPageAgentExecLogRepository logRepository;

    @GetMapping
    public List<DashboardPageMyAgentDto> list(@RequestParam(required = false) String userId) {
        String uid = userId == null || userId.isBlank() ? "u-001" : userId;
        return agentRepository.findByUserIdOrderBySortOrderAsc(uid).stream()
                .map(e -> new DashboardPageMyAgentDto(
                        e.getName(), e.getType(), e.getTypeLabel(),
                        e.getStatus(), e.getStatusClass(), e.getDescription(),
                        e.getTasks(), e.getSuccessRate(), e.getIcon()))
                .toList();
    }

    @GetMapping("/logs")
    public List<DashboardPageAgentExecLogDto> logs(@RequestParam(required = false) String userId) {
        String uid = userId == null || userId.isBlank() ? "u-001" : userId;
        return logRepository.findByUserIdOrderBySortOrderAsc(uid).stream()
                .map(e -> new DashboardPageAgentExecLogDto(
                        e.getLogId(), e.getAgent(), e.getAgentId(),
                        e.getExecTime(), e.getDuration(), e.getStatus(),
                        e.getStatusClass(), e.getDotClass(), e.getTrigger(), e.getTokens()))
                .toList();
    }
}