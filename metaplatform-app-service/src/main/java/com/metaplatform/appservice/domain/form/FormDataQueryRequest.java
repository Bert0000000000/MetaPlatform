package com.metaplatform.appservice.domain.form;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 表单提交数据查询参数。
 *
 * <p>排序语法：{@code -amount} 表示按 amount 降序；可传多个 sort 字段，按顺序生效。
 * 过滤语法：{@code amount>1000}、{@code name~张}、{@code status=approved}、{@code remark:} 表示为空。
 */
public class FormDataQueryRequest {

    private int page = 1;
    private int size = 20;
    private List<String> sort = Collections.emptyList();
    private Map<String, String> filters = Collections.emptyMap();
    private List<String> columns = Collections.emptyList();

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = Math.max(1, page);
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = Math.max(1, Math.min(size, 200));
    }

    public List<String> getSort() {
        return sort;
    }

    public void setSort(List<String> sort) {
        this.sort = sort == null ? Collections.emptyList() : sort;
    }

    public Map<String, String> getFilters() {
        return filters;
    }

    public void setFilters(Map<String, String> filters) {
        this.filters = filters == null ? Collections.emptyMap() : filters;
    }

    public List<String> getColumns() {
        return columns;
    }

    public void setColumns(List<String> columns) {
        this.columns = columns == null ? Collections.emptyList() : columns;
    }

    public int getOffset() {
        return (page - 1) * size;
    }
}
