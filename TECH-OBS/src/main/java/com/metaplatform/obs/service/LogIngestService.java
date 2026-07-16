package com.metaplatform.obs.service;

import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.dto.LogIngestRequest;
import com.metaplatform.obs.entity.ObsLogEntity;
import com.metaplatform.obs.repository.ObsLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class LogIngestService {

    private final ObsLogRepository obsLogRepository;

    public String ingest(LogIngestRequest request) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();

        ObsLogEntity entity = ObsLogEntity.builder()
                .id(id)
                .tenantId(TenantContext.get())
                .serviceName(request.getServiceName())
                .level(request.getLevel())
                .traceId(request.getTraceId())
                .message(request.getMessage())
                .labels(request.getLabels())
                .createdAt(request.getTimestamp() != null ? request.getTimestamp() : now)
                .build();

        obsLogRepository.insert(entity);
        log.debug("Log ingested: id={}, service={}, level={}", id, request.getServiceName(), request.getLevel());
        return id;
    }
}