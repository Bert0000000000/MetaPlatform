package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.dto.DashboardSummaryDto;
import com.metaplatform.dashboard.service.DashboardSummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class SummaryController {
    private final DashboardSummaryService service;
    @GetMapping("/summary")
    public Mono<DashboardSummaryDto> summary(@RequestParam String userId) { return service.getSummary(userId); }
}
