package com.metaplatform.obs.alert.controller;

import com.metaplatform.obs.alert.dto.NotificationChannelRequest;
import com.metaplatform.obs.alert.entity.NotificationChannelEntity;
import com.metaplatform.obs.alert.service.AlertService;
import com.metaplatform.obs.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/obs/notification-channels")
@RequiredArgsConstructor
public class NotificationChannelController {

    private final AlertService alertService;

    @PostMapping
    public ApiResponse<NotificationChannelEntity> create(@Valid @RequestBody NotificationChannelRequest request) {
        log.debug("Create notification channel: {}", request.getName());
        return ApiResponse.success(alertService.createChannel(request));
    }

    @GetMapping
    public ApiResponse<List<NotificationChannelEntity>> list() {
        log.debug("List notification channels");
        return ApiResponse.success(alertService.listChannels());
    }

    @GetMapping("/{id}")
    public ApiResponse<NotificationChannelEntity> get(@PathVariable UUID id) {
        log.debug("Get notification channel: {}", id);
        return ApiResponse.success(alertService.getChannel(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<NotificationChannelEntity> update(@PathVariable UUID id,
                                                         @Valid @RequestBody NotificationChannelRequest request) {
        log.debug("Update notification channel: {}", id);
        return ApiResponse.success(alertService.updateChannel(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        log.debug("Delete notification channel: {}", id);
        alertService.deleteChannel(id);
        return ApiResponse.success();
    }
}