package com.metaplatform.appservice.api.page;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * B1.1 分页结果 PageResult 单元测试.
 *
 * <p>覆盖: hasNext/hasPrev 推导 / totalPages 计算 / from(Page) 转换 / immutability.
 */
class PageResultTest {

    @Test
    void emptyPage_totalZero() {
        var pr = PageResult.of(List.of(), 0, 1, 50);
        assertEquals(0, pr.total());
        assertEquals(0, pr.totalPages());
        assertFalse(pr.hasNext());
        assertFalse(pr.hasPrev());
    }

    @Test
    void firstPageOfMany() {
        var items = IntStream.range(1, 11).mapToObj(i -> "item" + i).toList();
        var pr = PageResult.of(items, 100, 1, 10);
        assertEquals(100, pr.total());
        assertEquals(10, pr.totalPages());
        assertEquals(10, pr.items().size());
        assertFalse(pr.hasNext() == false);  // 第 1 页有下一页
        assertTrue(pr.hasNext());
        assertFalse(pr.hasPrev());
    }

    @Test
    void lastPageOfMany() {
        var items = IntStream.range(91, 101).mapToObj(i -> "item" + i).toList();
        var pr = PageResult.of(items, 100, 10, 10);
        assertEquals(10, pr.totalPages());
        assertFalse(pr.hasNext());
        assertTrue(pr.hasPrev());
    }

    @Test
    void middlePage() {
        var pr = PageResult.of(List.of("a", "b", "c"), 100, 5, 10);
        assertTrue(pr.hasNext());
        assertTrue(pr.hasPrev());
    }

    @Test
    void totalPagesRoundingUp() {
        // 101 条, size=10 → totalPages = 11 (向上取整)
        var pr = PageResult.of(List.of(), 101, 1, 10);
        assertEquals(11, pr.totalPages());
    }

    @Test
    void totalPagesRoundingUp_exactMultiple() {
        // 100 条, size=10 → totalPages = 10
        var pr = PageResult.of(List.of(), 100, 1, 10);
        assertEquals(10, pr.totalPages());
    }

    @Test
    void totalPages_whenLessThanSize() {
        // 5 条, size=10 → totalPages = 1
        var pr = PageResult.of(List.of("a", "b", "c", "d", "e"), 5, 1, 10);
        assertEquals(1, pr.totalPages());
        assertFalse(pr.hasNext());
        assertFalse(pr.hasPrev());
    }

    @Test
    void fromSpringPage_convertsZeroBasedToOneBased() {
        // Spring Page 是 0-based, 我们对外是 1-based
        var springPage = new PageImpl<>(
                List.of("a", "b", "c"),
                PageRequest.of(0, 10),  // 0-based
                100);
        var pr = PageResult.from(springPage);
        assertEquals(1, pr.page());  // 转换为 1-based
        assertEquals(10, pr.size());
        assertEquals(100, pr.total());
        assertEquals(10, pr.totalPages());
    }

    @Test
    void fromSpringPage_middlePage() {
        var springPage = new PageImpl<>(
                List.of("x", "y"),
                PageRequest.of(2, 10),  // 0-based 第 3 页
                100);
        var pr = PageResult.from(springPage);
        assertEquals(3, pr.page());  // 1-based 第 3 页
        assertTrue(pr.hasNext());
        assertTrue(pr.hasPrev());
    }

    @Test
    void fromSpringPage_withMapper() {
        var springPage = new PageImpl<>(
                List.of(1, 2, 3),
                PageRequest.of(0, 10),
                3);
        var pr = PageResult.from(springPage, i -> "v" + i);
        assertEquals(List.of("v1", "v2", "v3"), pr.items());
        assertEquals(3, pr.total());
    }

    @Test
    void nullItems_convertedToEmptyList() {
        var pr = PageResult.of(null, 0, 1, 10);
        assertNotNull(pr.items());
        assertTrue(pr.items().isEmpty());
    }

    @Test
    void itemsAreImmutable() {
        var pr = PageResult.of(List.of("a"), 1, 1, 10);
        assertThrows(UnsupportedOperationException.class,
                () -> pr.items().add("b"),
                "items 应为不可变列表 (防止调用方误改)");
    }

    @Test
    void edgeCase_pageBeyondTotal() {
        // 假设 total=5, size=10, 用户请求 page=10 (越界)
        // 应返回空 items 但 total 仍为 5
        var pr = PageResult.of(List.of(), 5, 10, 10);
        assertEquals(5, pr.total());
        assertEquals(1, pr.totalPages());  // 仍只有 1 页
        assertFalse(pr.hasNext());         // 越界无 next
        assertTrue(pr.hasPrev());          // 越界有 prev
        assertTrue(pr.items().isEmpty());
    }
}