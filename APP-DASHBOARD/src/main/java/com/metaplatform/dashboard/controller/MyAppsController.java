package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.dto.DashboardPageMyAppDto;
import com.metaplatform.dashboard.repository.DashboardPageMyAppRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard/myapps")
@RequiredArgsConstructor
public class MyAppsController {
    private final DashboardPageMyAppRepository repository;

    @GetMapping
    public List<DashboardPageMyAppDto> list(@RequestParam(required = false) String userId) {
        String uid = userId == null || userId.isBlank() ? "u-001" : userId;
        return repository.findByUserIdOrderByPinnedDescSortOrderAsc(uid).stream()
                .map(e -> new DashboardPageMyAppDto(
                        e.getName(), e.getType(), e.getTypeLabel(),
                        e.getDescription(), e.getLastUsed(), e.getDate(),
                        e.getUsage(), e.getIcon(), e.getPinned()))
                .toList();
    }
}