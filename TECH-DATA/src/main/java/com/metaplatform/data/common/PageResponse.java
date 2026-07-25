package com.metaplatform.data.common;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.domain.Page;

import java.util.Collections;
import java.util.List;

/**
 * 分页响应封装。
 *
 * <p>字段命名遵循前端约定：{@code items / total / page / pageSize / totalPages}。</p>
 *
 * @param <T> 列表元素类型
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {

    private List<T> items;
    private long total;
    private int page;
    private int pageSize;
    private int totalPages;

    public static <T> PageResponse<T> of(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getTotalElements(),
                page.getNumber() + 1,
                page.getSize(),
                page.getTotalPages());
    }

    public static <T> PageResponse<T> of(List<T> items, long total, int page, int pageSize) {
        int totalPages = pageSize > 0 ? (int) Math.ceil((double) total / pageSize) : 0;
        return new PageResponse<>(items, total, page, pageSize, totalPages);
    }

    public static <T> PageResponse<T> empty(int page, int pageSize) {
        return new PageResponse<>(Collections.emptyList(), 0L, page, pageSize, 0);
    }
}
