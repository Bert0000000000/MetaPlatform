package com.metaplatform.copilot.service;

import com.metaplatform.copilot.entity.SchedulingRecordEntity;
import com.metaplatform.copilot.repository.SchedulingRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SchedulingService {
    private final SchedulingRecordRepository repository;

    public SchedulingRecordEntity recordScheduling(SchedulingRecordEntity record) {
        if (record.getStartedAt() == null) record.setStartedAt(LocalDateTime.now());
        return repository.save(record);
    }

    public SchedulingRecordEntity getSchedulingRecord(String recordId) {
        return repository.findByRecordId(recordId)
                .orElseThrow(() -> new IllegalStateException("调度记录不存在: " + recordId));
    }

    public Page<SchedulingRecordEntity> listRecords(String userId, String status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        LocalDateTime allTime = LocalDateTime.of(2000, 1, 1, 0, 0);
        if (status == null || status.isBlank()) {
            return repository.findByUserIdAndStartedAtAfterOrderByStartedAtDesc(userId, allTime, pageable);
        }
        return repository.findByUserIdAndStatusAndStartedAtAfterOrderByStartedAtDesc(userId, status, allTime, pageable);
    }

    public Map<String, Object> getStats(String userId, int days) {
        LocalDateTime after = LocalDateTime.now().minusDays(days);
        List<SchedulingRecordEntity> records = repository.findByUserIdAndStartedAtAfter(userId, after);
        long total = records.size();
        long success = records.stream().filter(r -> "SUCCESS".equals(r.getStatus())).count();
        long partial = records.stream().filter(r -> "PARTIAL_SUCCESS".equals(r.getStatus())).count();
        long failed = records.stream().filter(r -> "FAILED".equals(r.getStatus())).count();
        long timeout = records.stream().filter(r -> "TIMEOUT".equals(r.getStatus())).count();
        long fallback = records.stream().filter(r -> "FALLBACK".equals(r.getStatus())).count();
        long successCount = success + partial;
        double successRate = total == 0 ? 0 : (double) successCount / total;
        double avgLatency = records.stream().filter(r -> r.getLatencyMs() > 0)
                .mapToLong(SchedulingRecordEntity::getLatencyMs).average().orElse(0);
        Map<String, Long> intentDist = new HashMap<>();
        for (SchedulingRecordEntity r : records) {
            String t = r.getIntentType() == null ? "UNKNOWN" : r.getIntentType();
            intentDist.merge(t, 1L, Long::sum);
        }
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", total);
        stats.put("success", successCount);
        stats.put("failed", failed);
        stats.put("timeout", timeout);
        stats.put("fallback", fallback);
        stats.put("successRate", successRate);
        stats.put("avgLatencyMs", avgLatency);
        stats.put("intentDistribution", intentDist);
        return stats;
    }
}