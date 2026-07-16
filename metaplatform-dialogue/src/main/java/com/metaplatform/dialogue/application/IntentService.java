package com.metaplatform.dialogue.application;

import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.intent.IntentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 意图服务。管理意图注册和查询。
 */
@Service
public class IntentService {

    private static final Logger log = LoggerFactory.getLogger(IntentService.class);

    private final IntentRepository intentRepository;

    public IntentService(IntentRepository intentRepository) {
        this.intentRepository = intentRepository;
    }

    /**
     * 注册一个新的意图。
     */
    public Intent register(Intent intent) {
        intentRepository.save(intent);
        log.info("Registered intent: {} (category: {}, confidence: {})",
                intent.name(), intent.category(), intent.confidence());
        return intent;
    }

    /**
     * 根据ID查找意图。
     */
    public Intent findById(String id) {
        return intentRepository.findById(com.metaplatform.dialogue.domain.intent.IntentId.of(id))
                .orElseThrow(() -> new IllegalArgumentException("Intent not found: " + id));
    }

    /**
     * 按类别查询意图列表。
     */
    public List<Intent> findByCategory(com.metaplatform.dialogue.domain.intent.IntentCategory category) {
        return intentRepository.findByCategory(category);
    }

    /**
     * 获取所有已注册的意图。
     */
    public List<Intent> findAll() {
        return intentRepository.findAll();
    }

    /**
     * 删除意图。
     */
    public void delete(String id) {
        intentRepository.deleteById(com.metaplatform.dialogue.domain.intent.IntentId.of(id));
        log.info("Deleted intent: {}", id);
    }
}
