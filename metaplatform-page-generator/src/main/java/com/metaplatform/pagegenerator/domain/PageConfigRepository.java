package com.metaplatform.pagegenerator.domain;

import com.metaplatform.pagegenerator.domain.enums.PageType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

/**
 * PageConfig 仓储接口
 */
@Repository
public interface PageConfigRepository extends JpaRepository<PageConfig, Long> {

    List<PageConfig> findByPageType(PageType pageType);

    List<PageConfig> findByObjectCode(String objectCode);

    Optional<PageConfig> findByCode(String code);

    List<PageConfig> findByPageTypeAndObjectCode(PageType pageType, String objectCode);
}
