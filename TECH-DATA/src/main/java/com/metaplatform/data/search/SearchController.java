package com.metaplatform.data.search;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.search.dto.SearchResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 全局搜索端点。
 *
 * <p>对应 Python app/api/v1/search.py（1 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public ApiResponse<SearchResponse> search(
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(searchService.search(keyword, page, pageSize));
    }
}
