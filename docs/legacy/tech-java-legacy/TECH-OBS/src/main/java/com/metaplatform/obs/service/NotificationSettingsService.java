package com.metaplatform.obs.service;

import com.metaplatform.obs.entity.NotificationSettingsEntity;
import com.metaplatform.obs.repository.NotificationSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class NotificationSettingsService {

    private final NotificationSettingsRepository settingsRepository;

    public NotificationSettingsEntity getByUserId(String userId) {
        return settingsRepository.findByUserId(userId)
                .orElseGet(() -> defaultSettings(userId));
    }

    public NotificationSettingsEntity save(NotificationSettingsEntity entity) {
        NotificationSettingsEntity existing = getByUserId(entity.getUserId());
        return settingsRepository.save(entity.toBuilder()
                .id(existing.getId())
                .tenantId(entity.getTenantId() != null ? entity.getTenantId() : existing.getTenantId())
                .createdAt(existing.getCreatedAt() != null ? existing.getCreatedAt() : Instant.now())
                .build());
    }

    private NotificationSettingsEntity defaultSettings(String userId) {
        return NotificationSettingsEntity.builder()
                .userId(userId)
                .approval(true)
                .task(true)
                .system(true)
                .mention(true)
                .alert(true)
                .email(false)
                .push(false)
                .build();
    }
}
