package com.metaplatform.dashboard.service;

import com.metaplatform.dashboard.entity.ShortcutEntity;
import com.metaplatform.dashboard.repository.ShortcutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ShortcutService {
    private final ShortcutRepository repository;

    public List<ShortcutEntity> list(String userId) { return repository.findByUserIdOrderBySortOrderAsc(userId); }

    @Transactional
    public List<ShortcutEntity> replace(String userId, List<ShortcutEntity> shortcuts) {
        repository.deleteByUserId(userId);
        shortcuts.forEach(item -> { item.setId(null); item.setUserId(userId); });
        return repository.saveAll(shortcuts);
    }
}
