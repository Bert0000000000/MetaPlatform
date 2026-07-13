package com.metaplatform.appservice.api.page;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * v1.0.2 通用分页结果封装.
 *
 * <p>与 Spring Data 的 {@link Page} 等价但解耦, 便于 API 层独立控制 JSON 字段名,
 * 同时避免在响应里泄漏 Pageable / Sort 等内部类型.
 *
 * <p>字段命名遵循 v1.0.2 API 规范:
 * <ul>
 *   <li>{@code items}: 当前页数据</li>
 *   <li>{@code total}: 总记录数</li>
 *   <li>{@code page}: 当前页码 (1-based, 与请求参数一致)</li>
 *   <li>{@code size}: 每页大小</li>
 *   <li>{@code totalPages}: 总页数</li>
 *   <li>{@code hasNext}: 是否有下一页</li>
 *   <li>{@code hasPrev}: 是否有上一页</li>
 * </ul>
 *
 * <p>B1.1 引入.
 */
public record PageResult<T>(
        List<T> items,
        long total,
        int page,
        int size,
        int totalPages,
        boolean hasNext,
        boolean hasPrev
) {
    /**
     * 紧凑构造器 (canonical): 自动推导 totalPages / hasNext / hasPrev.
     *
     * @param items 当前页数据 (可空列表)
     * @param total 数据库总记录数
     * @param page  1-based 页码
     * @param size  每页大小
     */
    public PageResult {
        items = items == null ? List.of() : List.copyOf(items);
        if (page < 1) page = 1;
        if (size < 1) size = 1;
        totalPages = (int) Math.ceil((double) total / size);
        if (totalPages < 1 && total == 0) totalPages = 0;
        hasNext = page < totalPages;
        hasPrev = page > 1;
    }

    /**
     * 便利构造器: 4 参数版本 (省略 totalPages/hasNext/hasPrev, 由紧凑构造器自动计算).
     * <p>方便单元测试和内部调用方使用, 不需要关心派生字段.
     */
    public static <T> PageResult<T> of(List<T> items, long total, int page, int size) {
        return new PageResult<>(items, total, page, size, 0, false, false);
    }

    /** 从 Spring Data {@link Page} 转换 (Map 模式, 不传 mapper 时拷贝 items). */
    public static <T> PageResult<T> from(Page<T> springPage) {
        int oneBasedPage = springPage.getNumber() + 1;  // Spring 是 0-based, 外部用 1-based
        int size = springPage.getSize();
        long total = springPage.getTotalElements();
        int totalPages = (int) Math.ceil((double) total / size);
        if (totalPages < 1 && total == 0) totalPages = 0;
        boolean hasNext = oneBasedPage < totalPages;
        boolean hasPrev = oneBasedPage > 1;
        return new PageResult<>(
                springPage.getContent(),
                total,
                oneBasedPage,
                size,
                totalPages,
                hasNext,
                hasPrev
        );
    }

    /** 从 Spring Data {@link Page} + 元素映射 转换. */
    public static <S, T> PageResult<T> from(Page<S> springPage, Function<S, T> mapper) {
        List<T> mapped = springPage.getContent().stream().map(mapper).toList();
        int oneBasedPage = springPage.getNumber() + 1;
        int size = springPage.getSize();
        long total = springPage.getTotalElements();
        int totalPages = (int) Math.ceil((double) total / size);
        if (totalPages < 1 && total == 0) totalPages = 0;
        return new PageResult<>(
                mapped,
                total,
                oneBasedPage,
                size,
                totalPages,
                oneBasedPage < totalPages,
                oneBasedPage > 1
        );
    }
}