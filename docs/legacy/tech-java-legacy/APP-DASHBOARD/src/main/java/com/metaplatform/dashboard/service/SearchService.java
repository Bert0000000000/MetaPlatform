package com.metaplatform.dashboard.service;

import com.metaplatform.dashboard.dto.SearchResponse;
import com.metaplatform.dashboard.entity.DeliverableEntity;
import com.metaplatform.dashboard.entity.FavoriteEntity;
import com.metaplatform.dashboard.entity.ShortcutEntity;
import com.metaplatform.dashboard.repository.DeliverableRepository;
import com.metaplatform.dashboard.repository.FavoriteRepository;
import com.metaplatform.dashboard.repository.ShortcutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final DeliverableRepository deliverableRepository;
    private final ShortcutRepository shortcutRepository;
    private final FavoriteRepository favoriteRepository;

    /**
     * 全局搜索：聚合搜索本地 deliverables + shortcuts + favorites。
     * TODO: 可选调用 TECH-ONT /api/v1/ont/graph/search 扩展本体搜索。
     */
    @Transactional(readOnly = true)
    public SearchResponse search(String userId, String keyword, String type, int limit) {
        List<SearchResponse.SearchResultItem> items = new ArrayList<>();
        String kw = keyword == null ? "" : keyword.toLowerCase();

        if (type == null || type.isBlank() || "all".equalsIgnoreCase(type) || "deliverable".equalsIgnoreCase(type)) {
            for (DeliverableEntity d : deliverableRepository.search(userId, null, null, kw,
                    org.springframework.data.domain.PageRequest.of(0, limit)).getContent()) {
                items.add(new SearchResponse.SearchResultItem(
                        "deliverable", d.getDeliverableId(), d.getTitle(),
                        d.getDescription(), d.getContentUrl()));
            }
        }

        if (type == null || type.isBlank() || "all".equalsIgnoreCase(type) || "shortcut".equalsIgnoreCase(type)) {
            for (ShortcutEntity s : shortcutRepository.findByUserIdOrderBySortOrderAsc(userId)) {
                if (s.getName() != null && s.getName().toLowerCase().contains(kw)) {
                    items.add(new SearchResponse.SearchResultItem(
                            "shortcut", String.valueOf(s.getId()), s.getName(),
                            null, s.getPath()));
                }
            }
        }

        if (type == null || type.isBlank() || "all".equalsIgnoreCase(type) || "favorite".equalsIgnoreCase(type)) {
            for (FavoriteEntity f : favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
                if (f.getResourceName() != null && f.getResourceName().toLowerCase().contains(kw)) {
                    items.add(new SearchResponse.SearchResultItem(
                            "favorite", f.getResourceId(), f.getResourceName(),
                            null, null));
                }
            }
        }

        if (items.size() > limit) {
            items = items.subList(0, limit);
        }
        return new SearchResponse(keyword, items.size(), items);
    }
}
