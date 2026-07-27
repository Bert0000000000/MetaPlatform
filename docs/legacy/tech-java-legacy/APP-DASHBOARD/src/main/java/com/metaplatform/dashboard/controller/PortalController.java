package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.dto.DashboardPagePortalDto;
import com.metaplatform.dashboard.repository.DashboardPagePortalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard/portal")
@RequiredArgsConstructor
public class PortalController {
    private final DashboardPagePortalRepository repository;

    @GetMapping
    public List<DashboardPagePortalDto> list(@RequestParam(required = false) String userId,
                                              @RequestParam(required = false) String kind) {
        String uid = userId == null || userId.isBlank() ? "u-001" : userId;
        if (kind != null && !kind.isBlank()) {
            return repository.findByUserIdAndKindOrderBySortOrderAsc(uid, kind).stream()
                    .map(this::toDto).toList();
        }
        return repository.findAll().stream()
                .filter(e -> uid.equals(e.getUserId()))
                .map(this::toDto).toList();
    }

    private DashboardPagePortalDto toDto(com.metaplatform.dashboard.entity.DashboardPagePortalEntity e) {
        return new DashboardPagePortalDto(
                e.getName(), e.getKind(), e.getDescription(), e.getIcon(),
                e.getVisits(), e.getLastVisit(), e.getUrl());
    }
}