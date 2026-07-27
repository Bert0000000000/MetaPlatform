package com.metaplatform.wfe.repository;

import com.metaplatform.wfe.entity.WfeOutboxMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WfeOutboxMessageRepository extends JpaRepository<WfeOutboxMessageEntity, String> {

    List<WfeOutboxMessageEntity> findTop50ByStatusOrderByCreatedAtAsc(String status);
}
