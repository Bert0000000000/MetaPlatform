package com.metaplatform.appservice.domain.form;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 表单提交数据分页查询结果。
 */
public class FormDataPageResult {

    private List<Map<String, Object>> rows;
    private long total;
    private int page;
    private int size;
    private List<String> sort;
    private Map<String, String> filters;

    public FormDataPageResult() {
        this.rows = Collections.emptyList();
    }

    public FormDataPageResult(List<Map<String, Object>> rows, long total, int page, int size,
                              List<String> sort, Map<String, String> filters) {
        this.rows = rows;
        this.total = total;
        this.page = page;
        this.size = size;
        this.sort = sort;
        this.filters = filters;
    }

    public List<Map<String, Object>> getRows() {
        return rows;
    }

    public void setRows(List<Map<String, Object>> rows) {
        this.rows = rows;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public List<String> getSort() {
        return sort;
    }

    public void setSort(List<String> sort) {
        this.sort = sort;
    }

    public Map<String, String> getFilters() {
        return filters;
    }

    public void setFilters(Map<String, String> filters) {
        this.filters = filters;
    }
}
