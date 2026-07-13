package com.metaplatform.appservice.domain.instance;

import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.form.FormDataQueryRequest;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * B1.4 AppObjectInstanceService.parseQueryRequest 单元测试.
 *
 * <p>覆盖:
 *  - 默认值 (page=1, size=20)
 *  - 自定义 page/size
 *  - sort 拆分逗号
 *  - filters 排除内置参数
 *  - columns 解析
 *  - 非法值抛 400
 */
class AppObjectInstanceServiceParseQueryRequestTest {

    @Test
    void defaults_whenAllEmpty() {
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(null);
        assertEquals(1, req.getPage());
        assertEquals(20, req.getSize());
        assertTrue(req.getSort().isEmpty());
        assertTrue(req.getFilters().isEmpty());
        assertTrue(req.getColumns().isEmpty());
    }

    @Test
    void customPageAndSize() {
        Map<String, String> p = new HashMap<>();
        p.put("page", "3");
        p.put("size", "50");
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(p);
        assertEquals(3, req.getPage());
        assertEquals(50, req.getSize());
    }

    @Test
    void invalidPage_throws() {
        Map<String, String> p = new HashMap<>();
        p.put("page", "abc");
        var ex = assertThrows(ApiException.class,
                () -> AppObjectInstanceService.parseQueryRequest(p));
        assertEquals(400, ex.getCode());
        assertTrue(ex.getMessage().contains("page"));
    }

    @Test
    void invalidSize_throws() {
        Map<String, String> p = new HashMap<>();
        p.put("size", "xyz");
        var ex = assertThrows(ApiException.class,
                () -> AppObjectInstanceService.parseQueryRequest(p));
        assertTrue(ex.getMessage().contains("size"));
    }

    @Test
    void sizeClampedToMax200() {
        Map<String, String> p = new HashMap<>();
        p.put("size", "500");
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(p);
        assertEquals(200, req.getSize());  // 上限 200
    }

    @Test
    void pageClampedToMin1() {
        Map<String, String> p = new HashMap<>();
        p.put("page", "0");
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(p);
        assertEquals(1, req.getPage());  // 下限 1
    }

    @Test
    void sort_commaSeparated() {
        Map<String, String> p = new HashMap<>();
        p.put("sort", "-amount,created_at");
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(p);
        assertEquals(2, req.getSort().size());
        assertEquals("-amount", req.getSort().get(0));
        assertEquals("created_at", req.getSort().get(1));
    }

    @Test
    void sort_trimWhitespace() {
        Map<String, String> p = new HashMap<>();
        p.put("sort", "  amount ,  -name ");
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(p);
        assertEquals(2, req.getSort().size());
        assertEquals("amount", req.getSort().get(0));
        assertEquals("-name", req.getSort().get(1));
    }

    @Test
    void sort_blankEntriesSkipped() {
        Map<String, String> p = new HashMap<>();
        p.put("sort", "amount,,,name");
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(p);
        assertEquals(2, req.getSort().size());
    }

    @Test
    void filters_excludeBuiltInParams() {
        Map<String, String> p = new HashMap<>();
        p.put("page", "1");
        p.put("size", "20");
        p.put("sort", "-amount");
        p.put("columns", "id,name");
        p.put("status", "active");  // 简单等值过滤器
        p.put("amount", "100");    // 简单等值过滤器 (新约定应改用 amount_gte)

        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(p);
        assertEquals(2, req.getFilters().size());
        // v1.0.2 B1.5: B1.4 新约定为简单 column=value 自动加 = 前缀
        assertEquals("=active", req.getFilters().get("status"));
        assertEquals("=100", req.getFilters().get("amount"));
        assertFalse(req.getFilters().containsKey("page"));
    }

    @Test
    void filters_opSuffix_converts() {
        // v1.0.2 B1.4: 操作符后缀语法
        Map<String, String> p = new HashMap<>();
        p.put("amount_gte", "100");
        p.put("status_eq", "active");
        p.put("name_like", "张");

        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(p);
        // 3 个 filter: amount (>=100), status (=active), name (~张)
        assertEquals(3, req.getFilters().size());
        assertEquals(">=100", req.getFilters().get("amount"));
        assertEquals("=active", req.getFilters().get("status"));
        assertEquals("~张", req.getFilters().get("name"));
    }

    @Test
    void columns_commaSeparated() {
        Map<String, String> p = new HashMap<>();
        p.put("columns", "id,name,amount");
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(p);
        assertEquals(3, req.getColumns().size());
        assertEquals("id", req.getColumns().get(0));
    }

    @Test
    void columns_emptyWhenNotProvided() {
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(new HashMap<>());
        assertTrue(req.getColumns().isEmpty());
    }

    @Test
    void nullParams_returnsDefaults() {
        // 安全: 当 Spring 注入 null 时不抛 NPE
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(null);
        assertEquals(1, req.getPage());
        assertEquals(20, req.getSize());
    }

    @Test
    void offset_calculatedCorrectly() {
        Map<String, String> p = new HashMap<>();
        p.put("page", "3");
        p.put("size", "20");
        FormDataQueryRequest req = AppObjectInstanceService.parseQueryRequest(p);
        assertEquals(40, req.getOffset());  // (3-1) * 20
    }
}