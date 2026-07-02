package com.metaplatform.dialogue.application;

import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.intent.IntentCategory;
import com.metaplatform.dialogue.infrastructure.parser.SimplePatternNLParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

class NaturalLanguageParserTest {

    private SimplePatternNLParser parser;

    @BeforeEach
    void setUp() {
        parser = new SimplePatternNLParser();
    }

    @ParameterizedTest
    @CsvSource({
            "查询所有客户, QUERY",
            "查找订单, QUERY",
            "搜索产品, QUERY",
            "list all users, QUERY",
            "创建一个新客户, CREATE",
            "添加订单, CREATE",
            "update user info, UPDATE",
            "修改客户信息, UPDATE",
            "删除这条记录, DELETE",
            "remove item, DELETE",
            "导出客户数据, EXPORT",
            "导入Excel, IMPORT",
            "帮助, HELP",
            "确认, CONFIRM",
            "取消, CANCEL"
    })
    void shouldDetectIntentCategory(String text, IntentCategory expectedCategory) {
        Intent intent = parser.parse(text);
        assertEquals(expectedCategory, intent.category(),
                "Expected " + expectedCategory + " for input: " + text);
        assertTrue(intent.confidence() > 0.0);
    }

    @Test
    void shouldReturnUnknownForUnrecognizedInput() {
        Intent intent = parser.parse("xyzzy foobar 12345");
        assertEquals(IntentCategory.UNKNOWN, intent.category());
        assertTrue(intent.confidence() < 0.5);
    }

    @Test
    void shouldHandleEmptyInput() {
        Intent intent = parser.parse("");
        assertEquals(IntentCategory.UNKNOWN, intent.category());
        assertEquals("empty_input", intent.name());
    }

    @Test
    void shouldHandleNullInput() {
        Intent intent = parser.parse(null);
        assertEquals(IntentCategory.UNKNOWN, intent.category());
    }

    @Test
    void shouldExtractTargetParameter() {
        Intent intent = parser.parse("查询所有客户");
        assertEquals("客户", intent.parameters().get("target"));
    }

    @Test
    void shouldExtractCreateTarget() {
        Intent intent = parser.parse("创建一个新订单");
        assertEquals("订单", intent.parameters().get("target"));
    }
}
