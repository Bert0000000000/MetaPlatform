package com.metaplatform.obs.controller;

import com.metaplatform.obs.common.ApiResponse;
import com.metaplatform.obs.entity.NotificationEntity;
import com.metaplatform.obs.entity.NotificationSettingsEntity;
import com.metaplatform.obs.service.NotificationService;
import com.metaplatform.obs.service.NotificationSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/obs/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationSettingsService notificationSettingsService;

    @GetMapping
    public ApiResponse<List<NotificationEntity>> list(
            @RequestParam String userId,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ApiResponse.success(notificationService.listByUser(userId, status, limit, offset));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Long> unreadCount(@RequestParam String userId) {
        return ApiResponse.success(notificationService.countUnread(userId));
    }

    @PutMapping("/{id}/read")
    public ApiResponse<Boolean> markRead(@PathVariable String id) {
        return ApiResponse.success(notificationService.markRead(id));
    }

    @PostMapping("/read-all")
    public ApiResponse<Integer> markAllRead(@RequestParam String userId) {
        return ApiResponse.success(notificationService.markAllRead(userId));
    }

    @GetMapping("/settings")
    public ApiResponse<NotificationSettingsEntity> getSettings(@RequestParam String userId) {
        return ApiResponse.success(notificationSettingsService.getByUserId(userId));
    }

    @PutMapping("/settings")
    public ApiResponse<NotificationSettingsEntity> updateSettings(@RequestBody NotificationSettingsEntity settings) {
        return ApiResponse.success(notificationSettingsService.save(settings));
    }
}
