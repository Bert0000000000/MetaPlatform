package com.metaplatform.dashboard.service;

import com.metaplatform.dashboard.entity.MetricConfigEntity;
import com.metaplatform.dashboard.repository.MetricConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MetricConfigService {

    private final MetricConfigRepository repository;

    @Transactional(readOnly = true)
    public List<MetricConfigEntity> getConfig(String userId) {
        return repository.findByUserIdOrderBySortOrderAsc(userId);
    }

    @Transactional
    public List<MetricConfigEntity> saveConfig(String userId, List<MetricConfigEntity> configs) {
        repository.deleteByUserId(userId);
        configs.forEach(c -> {
            c.setId(null);
            c.setUserId(userId);
        });
        return repository.saveAll(configs);
    }
}
