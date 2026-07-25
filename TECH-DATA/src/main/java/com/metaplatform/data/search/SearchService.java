package com.metaplatform.data.search;

import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.entity.CatalogAssetEntity;
import com.metaplatform.data.entity.DeliverableEntity;
import com.metaplatform.data.repository.CatalogAssetRepository;
import com.metaplatform.data.repository.DeliverableRepository;
import com.metaplatform.data.search.dto.SearchResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 全局搜索服务：聚合目录资产 + 交付物。
 *
 * <p>对应 Python app/search/service.py 的 SearchService。</p>
 *
 * <p>直接注入 CatalogAssetRepository + DeliverableRepository，
 * 跨两者做 ILIKE 关键词聚合，返回带类型标记的搜索命中。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private static final int MAX_SCAN_SIZE = 1000;

    private final CatalogAssetRepository catalogAssetRepository;
    private final DeliverableRepository deliverableRepository;

    /**
     * 全局搜索。
     */
    @Transactional(readOnly = true)
    public SearchResponse search(String keyword, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String lower = keyword != null ? keyword.toLowerCase() : "";

        List<SearchResponse.SearchHit> hits = new ArrayList<>();

        // 目录资产
        Page<CatalogAssetEntity> assets = catalogAssetRepository.findByTenantId(tenantId,
                PageRequest.of(0, MAX_SCAN_SIZE, Sort.by(Sort.Direction.DESC, "createdAt")));
        for (CatalogAssetEntity asset : assets.getContent()) {
            if (matches(asset.getName(), asset.getDescription(), lower)) {
                hits.add(SearchResponse.SearchHit.builder()
                        .id(asset.getId())
                        .type("catalog_asset")
                        .name(asset.getName())
                        .description(asset.getDescription())
                        .source(asset.getSource())
                        .highlight(buildHighlight(asset.getName(), asset.getDescription(), lower))
                        .build());
            }
        }

        // 交付物
        Page<DeliverableEntity> deliverables = deliverableRepository.findByTenantId(tenantId,
                PageRequest.of(0, MAX_SCAN_SIZE, Sort.by(Sort.Direction.DESC, "createdAt")));
        for (DeliverableEntity d : deliverables.getContent()) {
            if (matches(d.getTitle(), d.getDescription(), lower)) {
                hits.add(SearchResponse.SearchHit.builder()
                        .id(d.getId())
                        .type("deliverable")
                        .name(d.getTitle())
                        .description(d.getDescription())
                        .source(d.getSource())
                        .highlight(buildHighlight(d.getTitle(), d.getDescription(), lower))
                        .build());
            }
        }

        // 内存分页
        int total = hits.size();
        int from = Math.min((page - 1) * pageSize, total);
        int to = Math.min(from + pageSize, total);
        List<SearchResponse.SearchHit> paged = from < to ? hits.subList(from, to) : List.of();

        log.info("全局搜索 | tenant={} keyword={} hits={}", tenantId, keyword, total);
        return SearchResponse.builder()
                .keyword(keyword != null ? keyword : "")
                .total(total)
                .hits(paged)
                .build();
    }

    private boolean matches(String name, String description, String lower) {
        if (lower == null || lower.isBlank()) return true;
        if (name != null && name.toLowerCase().contains(lower)) return true;
        if (description != null && description.toLowerCase().contains(lower)) return true;
        return false;
    }

    private String buildHighlight(String name, String description, String keyword) {
        if (keyword == null || keyword.isBlank()) return null;
        StringBuilder sb = new StringBuilder();
        if (name != null && name.toLowerCase().contains(keyword)) {
            sb.append("name: ").append(name);
        }
        if (description != null && description.toLowerCase().contains(keyword)) {
            if (sb.length() > 0) sb.append(" | ");
            sb.append("description: ").append(description);
        }
        return sb.length() > 0 ? sb.toString() : null;
    }
}
