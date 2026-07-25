package com.metaplatform.dw.service;

import com.metaplatform.dw.entity.KbBindingEntity;
import com.metaplatform.dw.entity.RetrievalConfigEntity;
import com.metaplatform.dw.repository.KbBindingRepository;
import com.metaplatform.dw.repository.RetrievalConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class KbBindingService {
    private final KbBindingRepository bindingRepository;
    private final RetrievalConfigRepository configRepository;

    public KbBindingEntity bindKb(String employeeId, String kbId, String retrievalConfigId, Integer priority) {
        Optional<KbBindingEntity> existing = bindingRepository.findByEmployeeIdAndKbId(employeeId, kbId);
        if (existing.isPresent()) {
            KbBindingEntity entity = existing.get();
            entity.setRetrievalConfigId(retrievalConfigId);
            entity.setPriority(priority != null ? priority : entity.getPriority());
            entity.setStatus("ACTIVE");
            return bindingRepository.save(entity);
        }
        KbBindingEntity entity = new KbBindingEntity();
        entity.setEmployeeId(employeeId);
        entity.setKbId(kbId);
        entity.setRetrievalConfigId(retrievalConfigId);
        entity.setPriority(priority != null ? priority : 0);
        return bindingRepository.save(entity);
    }

    public void unbindKb(String employeeId, String kbId) {
        bindingRepository.deleteByEmployeeIdAndKbId(employeeId, kbId);
    }

    public List<KbBindingEntity> listBindings(String employeeId) {
        return bindingRepository.findByEmployeeIdOrderByPriorityDesc(employeeId);
    }

    public RetrievalConfigEntity getOrCreateRetrievalConfig(String employeeId) {
        return configRepository.findByEmployeeId(employeeId).orElseGet(() -> {
            RetrievalConfigEntity cfg = new RetrievalConfigEntity();
            cfg.setEmployeeId(employeeId);
            return configRepository.save(cfg);
        });
    }

    public RetrievalConfigEntity updateRetrievalConfig(RetrievalConfigEntity cfg) {
        if (cfg.getEmployeeId() == null || cfg.getEmployeeId().isBlank()) {
            throw new IllegalStateException("employeeId 必填");
        }
        RetrievalConfigEntity existing = getOrCreateRetrievalConfig(cfg.getEmployeeId());
        if (cfg.getTopK() != null) existing.setTopK(cfg.getTopK());
        if (cfg.getScoreThreshold() != null) existing.setScoreThreshold(cfg.getScoreThreshold());
        if (cfg.getEnableRerank() != null) existing.setEnableRerank(cfg.getEnableRerank());
        if (cfg.getMaxCitations() != null) existing.setMaxCitations(cfg.getMaxCitations());
        if (cfg.getEnableStreaming() != null) existing.setEnableStreaming(cfg.getEnableStreaming());
        if (cfg.getStrategy() != null) existing.setStrategy(cfg.getStrategy());
        return configRepository.save(existing);
    }
}