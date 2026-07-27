package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.entity.RecentVisitEntity;
import com.metaplatform.dashboard.service.RecentVisitService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard/recent")
@RequiredArgsConstructor
public class RecentController {
    private final RecentVisitService service;
    @GetMapping public List<RecentVisitEntity> list(@RequestParam String userId) { return service.list(userId); }
    @PostMapping public RecentVisitEntity record(@RequestParam String userId, @RequestBody RecentVisitEntity visit) { return service.record(userId, visit); }
}
