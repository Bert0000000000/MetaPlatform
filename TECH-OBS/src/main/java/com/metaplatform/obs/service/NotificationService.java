package com.metaplatform.obs.service;

import com.metaplatform.obs.entity.NotificationEntity;
import com.metaplatform.obs.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public List<NotificationEntity> listByUser(String userId, String status, int limit, int offset) {
        return notificationRepository.findByUser(userId, status, limit, offset);
    }

    public long countUnread(String userId) {
        return notificationRepository.countUnreadByUser(userId);
    }

    public boolean markRead(String id) {
        return notificationRepository.markRead(id) > 0;
    }

    public int markAllRead(String userId) {
        return notificationRepository.markAllReadByUser(userId);
    }

    public NotificationEntity create(String tenantId, String userId, String type, String title, String content, String link) {
        return notificationRepository.insert(NotificationEntity.builder()
                .tenantId(tenantId)
                .userId(userId)
                .type(type)
                .title(title)
                .content(content)
                .read(false)
                .link(link)
                .createdAt(Instant.now())
                .build());
    }
}
