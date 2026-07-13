package com.metaplatform.appservice.api.page;

import com.metaplatform.appservice.api.error.ApiException;

/**
 * v1.0.2 通用分页请求参数.
 *
 * <p>约定:
 * <ul>
 *   <li>{@code page}: 1-based, 默认 1</li>
 *   <li>{@code size}: 默认 50, 范围 1-500</li>
 *   <li>{@code null} 表示"客户端未传", 内部用默认值</li>
 * </ul>
 *
 * <p>B1.1 引入.
 */
public record PageParams(Integer page, Integer size) {
    public static final int DEFAULT_PAGE = 1;
    public static final int DEFAULT_SIZE = 50;
    public static final int MAX_SIZE = 500;

    public PageParams {
        if (page == null) page = DEFAULT_PAGE;
        if (size == null) size = DEFAULT_SIZE;
        if (page < 1) {
            throw ApiException.badRequest("page 必须 >= 1");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw ApiException.badRequest("size 必须在 1 ~ " + MAX_SIZE + " 之间");
        }
    }

    /** Spring Data 0-based 页码. */
    public int zeroBasedPage() {
        return page - 1;
    }

    public int offset() {
        return zeroBasedPage() * size;
    }

    /** 是否为默认请求 (向后兼容标记). */
    public boolean isDefault() {
        return page == DEFAULT_PAGE && size == DEFAULT_SIZE;
    }
}