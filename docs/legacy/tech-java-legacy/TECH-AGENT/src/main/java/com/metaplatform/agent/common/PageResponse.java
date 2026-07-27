package com.metaplatform.agent.common;

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

    /** 当前页数据。 */
    private List<T> items;

    /** 总记录数。 */
    private long total;

    /** 当前页码（1-based）。 */
    private int page;

    /** 每页大小。 */
    private int pageSize;

    /** 总页数。 */
    private int totalPages;

    /**
     * 从 Spring Data Page 构造（页码自动转 1-based）。
     */
    public static <T> PageResponse<T> of(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getTotalElements(),
                page.getNumber() + 1,
                page.getSize(),
                page.getTotalPages());
    }

    /**
     * 从原始列表构造。
     */
    public static <T> PageResponse<T> of(List<T> items, long total, int page, int pageSize) {
        int totalPages = pageSize > 0 ? (int) Math.ceil((double) total / pageSize) : 0;
        return new PageResponse<>(items, total, page, pageSize, totalPages);
    }

    /**
     * 空响应。
     */
    public static <T> PageResponse<T> empty(int page, int pageSize) {
        return new PageResponse<>(Collections.emptyList(), 0L, page, pageSize, 0);
    }
}
