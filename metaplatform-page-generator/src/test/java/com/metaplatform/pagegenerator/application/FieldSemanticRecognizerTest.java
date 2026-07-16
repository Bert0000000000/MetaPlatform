package com.metaplatform.pagegenerator.application;

import com.metaplatform.pagegenerator.domain.FieldDescriptor;
import com.metaplatform.pagegenerator.domain.enums.DataType;
import com.metaplatform.pagegenerator.domain.enums.WidgetType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class FieldSemanticRecognizerTest {

    private FieldSemanticRecognizer recognizer;

    @BeforeEach
    void setUp() {
        recognizer = new FieldSemanticRecognizer();
    }

    @Test
    void recognizeEmailField() {
        var field = new FieldDescriptor("email", "邮箱", DataType.STRING, 100);
        assertEquals(WidgetType.EMAIL, recognizer.recognize(field));
    }

    @Test
    void recognizeMailField() {
        var field = new FieldDescriptor("mail", "邮件", DataType.STRING, 100);
        assertEquals(WidgetType.EMAIL, recognizer.recognize(field));
    }

    @Test
    void recognizePhoneField() {
        var field = new FieldDescriptor("phone", "电话", DataType.STRING, 20);
        assertEquals(WidgetType.PHONE, recognizer.recognize(field));
    }

    @Test
    void recognizeMobileField() {
        var field = new FieldDescriptor("mobile", "手机", DataType.STRING, 20);
        assertEquals(WidgetType.PHONE, recognizer.recognize(field));
    }

    @Test
    void recognizeAmountField() {
        var field = new FieldDescriptor("totalAmount", "累计金额", DataType.BIG_DECIMAL, null);
        assertEquals(WidgetType.CURRENCY, recognizer.recognize(field));
    }

    @Test
    void recognizePriceField() {
        var field = new FieldDescriptor("price", "价格", DataType.BIG_DECIMAL, null);
        assertEquals(WidgetType.CURRENCY, recognizer.recognize(field));
    }

    @Test
    void recognizeUrlField() {
        var field = new FieldDescriptor("website", "网站", DataType.STRING, 500);
        assertEquals(WidgetType.URL, recognizer.recognize(field));
    }

    @Test
    void recognizePercentageField() {
        var field = new FieldDescriptor("discountRate", "折扣率", DataType.DOUBLE, null);
        assertEquals(WidgetType.PERCENTAGE, recognizer.recognize(field));
    }

    @Test
    void recognizeDateField() {
        var field = new FieldDescriptor("birthday", "生日", DataType.LOCAL_DATE, null);
        assertEquals(WidgetType.DATE, recognizer.recognize(field));
    }

    @Test
    void recognizeDateTimeField() {
        var field = new FieldDescriptor("createdAt", "创建时间", DataType.LOCAL_DATE_TIME, null);
        assertEquals(WidgetType.DATE_TIME, recognizer.recognize(field));
    }

    @Test
    void recognizeColorField() {
        var field = new FieldDescriptor("color", "颜色", DataType.STRING, 20);
        assertEquals(WidgetType.COLOR, recognizer.recognize(field));
    }

    @Test
    void recognizeDescriptionAsRichText() {
        var field = new FieldDescriptor("description", "描述", DataType.STRING, 2000);
        assertEquals(WidgetType.RICH_TEXT, recognizer.recognize(field));
    }

    @Test
    void recognizeAvatarAsImageUpload() {
        var field = new FieldDescriptor("avatar", "头像", DataType.STRING, 500);
        assertEquals(WidgetType.IMAGE_UPLOAD, recognizer.recognize(field));
    }

    @Test
    void recognizeStatusAsSelect() {
        var field = new FieldDescriptor("status", "状态", DataType.ENUM, null);
        assertEquals(WidgetType.SELECT, recognizer.recognize(field));
    }

    @Test
    void recognizeCategoryAsSelect() {
        var field = new FieldDescriptor("category", "分类", DataType.ENUM, null);
        assertEquals(WidgetType.SELECT, recognizer.recognize(field));
    }

    @Test
    void recognizeFileAsFileUpload() {
        var field = new FieldDescriptor("attachment", "附件", DataType.STRING, 500);
        assertEquals(WidgetType.FILE_UPLOAD, recognizer.recognize(field));
    }

    @Test
    void recognizeLongTextFieldAsTextarea() {
        // "memo" doesn't match any semantic keyword, falls to dataType: STRING, maxLength=2000 > 500 -> TEXTAREA
        var field = new FieldDescriptor("memo", "备注", DataType.STRING, 2000);
        assertEquals(WidgetType.TEXTAREA, recognizer.recognize(field));
    }

    @Test
    void recognizePlainStringAsText() {
        var field = new FieldDescriptor("code", "编码", DataType.STRING, 50);
        // "code" contains no semantic keyword matched to non-TEXT, falls to data type
        // Actually "code" matches the contains pattern for "code" in SEMANTIC_RULES? No.
        // Let me check - "code" does not match any SEMANTIC_RULES key via contains
        // Wait, actually it's checked against all entries, "code" doesn't contain "content", etc.
        // The recognizeFromSemantic will try exact match first (none), then contains (none),
        // so it falls to recognizeFromDataType: STRING, maxLength=50 < 500 -> TEXT
        assertEquals(WidgetType.TEXT, recognizer.recognize(field));
    }

    @Test
    void recognizeIntegerFieldAsNumber() {
        var field = new FieldDescriptor("stock", "库存", DataType.INTEGER, null);
        assertEquals(WidgetType.NUMBER, recognizer.recognize(field));
    }

    @Test
    void recognizeBooleanFieldAsCheckbox() {
        var field = new FieldDescriptor("isActive", "是否有效", DataType.BOOLEAN, null);
        assertEquals(WidgetType.CHECKBOX, recognizer.recognize(field));
    }

    @Test
    void recognizeReferenceFieldAsLookup() {
        var field = new FieldDescriptor("customerId", "客户", DataType.REFERENCE, null);
        assertEquals(WidgetType.LOOKUP, recognizer.recognize(field));
    }

    @Test
    void recognizeTimeField() {
        var field = new FieldDescriptor("workTime", "工作时间", DataType.LOCAL_TIME, null);
        // "workTime" contains "time" -> TIME
        assertEquals(WidgetType.TIME, recognizer.recognize(field));
    }

    @Test
    void recognizeChineseFieldName() {
        var field = new FieldDescriptor("邮箱地址", "邮箱地址", DataType.STRING, 100);
        assertEquals(WidgetType.EMAIL, recognizer.recognize(field));
    }

    @Test
    void recognizeBatch() {
        List<FieldDescriptor> fields = List.of(
                new FieldDescriptor("email", "邮箱", DataType.STRING, 100),
                new FieldDescriptor("phone", "电话", DataType.STRING, 20),
                new FieldDescriptor("status", "状态", DataType.ENUM, null),
                new FieldDescriptor("name", "名称", DataType.STRING, 100)
        );

        Map<String, WidgetType> result = recognizer.recognizeAll(fields);

        assertEquals(4, result.size());
        assertEquals(WidgetType.EMAIL, result.get("email"));
        assertEquals(WidgetType.PHONE, result.get("phone"));
        assertEquals(WidgetType.SELECT, result.get("status"));
        assertEquals(WidgetType.TEXT, result.get("name"));
    }

    @Test
    void recognizeNullDataTypeDefaultsToText() {
        var field = new FieldDescriptor("unknown", "未知", null, null);
        assertEquals(WidgetType.TEXT, recognizer.recognize(field));
    }
}
