package com.metaplatform.iam.service;

import com.metaplatform.iam.dto.session.UserSessionResponse;
import com.metaplatform.iam.entity.UserSessionEntity;
import com.metaplatform.iam.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserSessionService {

    private final UserSessionRepository userSessionRepository;

    @Transactional(readOnly = true)
    public List<UserSessionResponse> listByUserId(String userId) {
        return userSessionRepository.findByUserIdOrderByLastActiveAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void terminate(String id) {
        userSessionRepository.deleteById(id);
    }

    @Transactional
    public UserSessionResponse touch(String userId, String device, String ip, String location, boolean current) {
        UserSessionEntity entity = UserSessionEntity.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .device(device)
                .ip(ip)
                .location(location)
                .lastActiveAt(Instant.now())
                .current(current)
                .build();
        userSessionRepository.save(entity);
        return toResponse(entity);
    }

    private UserSessionResponse toResponse(UserSessionEntity entity) {
        return UserSessionResponse.builder()
                .id(entity.getId())
                .device(entity.getDevice())
                .ip(entity.getIp())
                .location(entity.getLocation())
                .lastActiveAt(entity.getLastActiveAt())
                .current(Boolean.TRUE.equals(entity.getCurrent()))
                .build();
    }
}
