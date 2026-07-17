package com.metaplatform.ea.valuestream.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.valuestream.dto.CreateValueStreamRequest;
import com.metaplatform.ea.valuestream.dto.CreateValueStreamStageRequest;
import com.metaplatform.ea.valuestream.dto.LinkCapabilityRequest;
import com.metaplatform.ea.valuestream.dto.UpdateValueStreamRequest;
import com.metaplatform.ea.valuestream.dto.UpdateValueStreamStageRequest;
import com.metaplatform.ea.valuestream.dto.ValueStreamResponse;
import com.metaplatform.ea.valuestream.dto.ValueStreamStageResponse;
import com.metaplatform.ea.valuestream.dto.VisualizationData;
import com.metaplatform.ea.valuestream.entity.ValueStreamCapabilityEntity;
import com.metaplatform.ea.valuestream.entity.ValueStreamEntity;
import com.metaplatform.ea.valuestream.entity.ValueStreamStageEntity;
import com.metaplatform.ea.valuestream.repository.ValueStreamCapabilityRepository;
import com.metaplatform.ea.valuestream.repository.ValueStreamRepository;
import com.metaplatform.ea.valuestream.repository.ValueStreamStageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ValueStreamService {

    private final ValueStreamRepository valueStreamRepository;
    private final ValueStreamCapabilityRepository capabilityRepository;
    private final ValueStreamStageRepository stageRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ValueStreamResponse create(CreateValueStreamRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (valueStreamRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "价值流编码已存在: " + request.getCode());
        }
        Instant now = Instant.now();
        ValueStreamEntity entity = ValueStreamEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .stages(writeJson(request.getStages() != null ? request.getStages() : List.of()))
                .status("ACTIVE")
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(valueStreamRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<ValueStreamResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return valueStreamRepository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ValueStreamResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ValueStreamResponse update(UUID id, UpdateValueStreamRequest request) {
        ValueStreamEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getStages() != null) entity.setStages(writeJson(request.getStages()));
        if (StringUtils.hasText(request.getStatus())) entity.setStatus(request.getStatus().toUpperCase());
        entity.setUpdatedAt(Instant.now());
        return toResponse(valueStreamRepository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        ValueStreamEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        valueStreamRepository.save(entity);
    }

    @Transactional
    public List<ValueStreamCapabilityEntity> linkCapabilities(UUID id, LinkCapabilityRequest request) {
        ValueStreamEntity entity = findById(id);
        String tenantId = TenantContext.getOrDefault();
        capabilityRepository.deleteByValueStreamId(id);
        List<ValueStreamCapabilityEntity> links = new ArrayList<>();
        for (UUID capId : request.getCapabilityIds()) {
            links.add(ValueStreamCapabilityEntity.builder()
                    .valueStreamId(id)
                    .capabilityId(capId)
                    .stageName(request.getStageName())
                    .tenantId(tenantId)
                    .createdAt(Instant.now())
                    .build());
        }
        return capabilityRepository.saveAll(links);
    }

    @Transactional(readOnly = true)
    public VisualizationData visualization(UUID id) {
        ValueStreamEntity entity = findById(id);
        List<String> stages = readStages(entity.getStages());
        List<ValueStreamCapabilityEntity> links = capabilityRepository.findByValueStreamId(id);

        Map<String, List<UUID>> stageMap = new LinkedHashMap<>();
        for (ValueStreamCapabilityEntity link : links) {
            String stage = link.getStageName() != null ? link.getStageName() : "default";
            stageMap.computeIfAbsent(stage, k -> new ArrayList<>()).add(link.getCapabilityId());
        }

        List<VisualizationData.StageCapability> stageCapabilities = stageMap.entrySet().stream()
                .map(e -> VisualizationData.StageCapability.builder()
                        .stageName(e.getKey())
                        .capabilityIds(e.getValue())
                        .build())
                .toList();

        return VisualizationData.builder()
                .valueStreamId(entity.getId())
                .name(entity.getName())
                .stages(stages)
                .stageCapabilities(stageCapabilities)
                .build();
    }

    private ValueStreamEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return valueStreamRepository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "价值流不存在"));
    }

    private List<String> readStages(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败");
        }
    }

    private ValueStreamResponse toResponse(ValueStreamEntity entity) {
        return ValueStreamResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .stages(readStages(entity.getStages()))
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
