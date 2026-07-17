package com.metaplatform.rule.repository;

import com.metaplatform.rule.entity.RuleOutboxMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RuleOutboxMessageRepository extends JpaRepository<RuleOutboxMessageEntity, String> {

    List<RuleOutboxMessageEntity> findTop50ByStatusOrderByCreatedAtAsc(String status);

    List<RuleOutboxMessageEntity> findByStatusOrderByCreatedAtAsc(String status);
}
