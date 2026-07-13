package com.metaplatform.appservice.api.page;

import com.metaplatform.appservice.api.error.ApiException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * B1.1 分页参数 PageParams 单元测试.
 *
 * <p>覆盖: 默认值 / 边界 / 非法值.
 */
class PageParamsTest {

    @Test
    void defaultValues_whenBothNull() {
        var p = new PageParams(null, null);
        assertEquals(1, p.page());
        assertEquals(50, p.size());
        assertEquals(0, p.offset());
        assertEquals(0, p.zeroBasedPage());
        assertTrue(p.isDefault());
    }

    @Test
    void customPageAndSize() {
        var p = new PageParams(3, 20);
        assertEquals(3, p.page());
        assertEquals(20, p.size());
        assertEquals(2, p.zeroBasedPage());
        assertEquals(40, p.offset());
        assertFalse(p.isDefault());
    }

    @Test
    void page1Offset0() {
        var p = new PageParams(1, 10);
        assertEquals(0, p.offset());
    }

    @Test
    void page2OffsetEqualsSize() {
        var p = new PageParams(2, 10);
        assertEquals(10, p.offset());
    }

    @Test
    void page0_throws() {
        var ex = assertThrows(ApiException.class, () -> new PageParams(0, 10));
        assertEquals(400, ex.getCode());
        assertTrue(ex.getMessage().contains("page"));
    }

    @Test
    void pageNegative_throws() {
        assertThrows(ApiException.class, () -> new PageParams(-1, 10));
    }

    @Test
    void size0_throws() {
        var ex = assertThrows(ApiException.class, () -> new PageParams(1, 0));
        assertEquals(400, ex.getCode());
        assertTrue(ex.getMessage().contains("size"));
    }

    @Test
    void sizeTooLarge_throws() {
        var ex = assertThrows(ApiException.class, () -> new PageParams(1, 501));
        assertEquals(400, ex.getCode());
        assertTrue(ex.getMessage().contains("500"));
    }

    @Test
    void sizeBoundaryMax_accepted() {
        var p = new PageParams(1, 500);
        assertEquals(500, p.size());
    }

    @Test
    void sizeBoundaryMin_accepted() {
        var p = new PageParams(1, 1);
        assertEquals(1, p.size());
    }

    @Test
    void offsetCalculation_largePage() {
        // 第 100 页, 每页 50 → offset = 4950
        var p = new PageParams(100, 50);
        assertEquals(99, p.zeroBasedPage());
        assertEquals(4950, p.offset());
    }
}