package com.metaplatform.dw.repository;

import com.metaplatform.dw.entity.RetrievalConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface RetrievalConfigRepository extends JpaRepository<RetrievalConfigEntity, Long> {
    Optional<RetrievalConfigEntity> findByEmployeeId(String employeeId);
}