package com.metaplatform.kb.repository;

import com.metaplatform.kb.entity.KbVersionDiffEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface KbVersionDiffRepository extends JpaRepository<KbVersionDiffEntity, Long> {
    List<KbVersionDiffEntity> findByKbIdOrderByCreatedAtDesc(String kbId);
}
