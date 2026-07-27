package com.metaplatform.rule.decisiontable.repository;

import com.metaplatform.rule.decisiontable.entity.DecisionTableRowEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DecisionTableRowRepository extends JpaRepository<DecisionTableRowEntity, String> {

    List<DecisionTableRowEntity> findByTableIdOrderByRowOrderAsc(String tableId);

    Optional<DecisionTableRowEntity> findByIdAndTableId(String id, String tableId);

    long countByTableId(String tableId);

    void deleteByTableId(String tableId);
}
