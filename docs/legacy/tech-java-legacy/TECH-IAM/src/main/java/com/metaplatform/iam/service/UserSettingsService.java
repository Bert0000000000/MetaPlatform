package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.dto.settings.UserSettingsResponse;
import com.metaplatform.iam.dto.settings.UserSettingsUpdateRequest;
import com.metaplatform.iam.entity.UserSettingsEntity;
import com.metaplatform.iam.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserSettingsService {

    private final UserSettingsRepository userSettingsRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public UserSettingsResponse getByUserId(String userId) {
        UserSettingsEntity entity = userSettingsRepository.findByUserId(userId)
                .orElseGet(() -> createDefault(userId));
        return toResponse(entity);
    }

    @Transactional
    public UserSettingsResponse update(UserSettingsUpdateRequest request) {
        UserSettingsEntity entity = userSettingsRepository.findByUserId(request.getUserId())
                .orElseGet(() -> createDefault(request.getUserId()));

        if (request.getLanguage() != null) entity.setLanguage(request.getLanguage());
        if (request.getTimezone() != null) entity.setTimezone(request.getTimezone());
        if (request.getDateFormat() != null) entity.setDateFormat(request.getDateFormat());
        if (request.getDefaultPage() != null) entity.setDefaultPage(request.getDefaultPage());
        if (request.getTheme() != null) entity.setTheme(request.getTheme());
        if (request.getLayout() != null) entity.setLayout(writeLayout(request.getLayout()));

        userSettingsRepository.save(entity);
        return toResponse(entity);
    }

    private UserSettingsEntity createDefault(String userId) {
        return userSettingsRepository.save(UserSettingsEntity.builder()
                .userId(userId)
                .language("zh-CN")
                .timezone("Asia/Shanghai")
                .dateFormat("YYYY-MM-DD HH:mm:ss")
                .defaultPage("/dashboard")
                .theme("light")
                .layout("[]")
                .build());
    }

    private UserSettingsResponse toResponse(UserSettingsEntity entity) {
        return UserSettingsResponse.builder()
                .userId(entity.getUserId())
                .language(entity.getLanguage())
                .timezone(entity.getTimezone())
                .dateFormat(entity.getDateFormat())
                .defaultPage(entity.getDefaultPage())
                .theme(entity.getTheme())
                .layout(readLayout(entity.getLayout()))
                .build();
    }

    @SneakyThrows
    private String writeLayout(List<String> layout) {
        if (layout == null) return "[]";
        return objectMapper.writeValueAsString(layout);
    }

    @SneakyThrows
    private List<String> readLayout(String layout) {
        if (layout == null || layout.isBlank()) return Collections.emptyList();
        return objectMapper.readValue(layout, new TypeReference<>() {});
    }
}
