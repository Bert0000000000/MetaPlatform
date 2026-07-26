package com.metaplatform.dashboard.controller;

import com.metaplatform.dashboard.dto.DashboardPageMessageDto;
import com.metaplatform.dashboard.repository.DashboardPageMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard/messages")
@RequiredArgsConstructor
public class MessagesController {
    private final DashboardPageMessageRepository repository;

    @GetMapping
    public List<DashboardPageMessageDto> list(@RequestParam(required = false) String userId) {
        String uid = userId == null || userId.isBlank() ? "u-001" : userId;
        return repository.findByUserIdOrderBySortOrderAsc(uid).stream()
                .map(e -> new DashboardPageMessageDto(
                        e.getMsgId(), e.getSender(), e.getAvatarClass(),
                        e.getIcon(), e.getTitle(), e.getSummary(),
                        e.getTime(), e.getPriority(), e.getUnread(), e.getAttachments()))
                .toList();
    }
}