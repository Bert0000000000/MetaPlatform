package com.metaplatform.pagegenerator.infrastructure.client;

import com.metaplatform.pagegenerator.domain.FieldDescriptor;
import com.metaplatform.pagegenerator.domain.ObjectMeta;
import com.metaplatform.pagegenerator.domain.enums.DataType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * ObjectType REST 客户端 - 调用 ontology-engine 获取 ObjectType 信息
 */
@Component
public class ObjectTypeClient {

    private static final Logger log = LoggerFactory.getLogger(ObjectTypeClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public ObjectTypeClient(RestTemplate restTemplate,
                            @Value("${services.ontology-engine.base-url:http://localhost:8081}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    /**
     * 根据 objectCode 获取 ObjectMeta
     * 如果 ontology-engine 不可用，返回内置的示例数据
     */
    public ObjectMeta getByCode(String objectCode) {
        try {
            String url = baseUrl + "/api/v1/object-types/" + objectCode;
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null) {
                return parseObjectMeta(response);
            }
        } catch (Exception e) {
            log.warn("Failed to fetch ObjectType from ontology-engine for code '{}': {}",
                    objectCode, e.getMessage());
        }
        // 回退到内置示例
        return getBuiltinSample(objectCode);
    }

    @SuppressWarnings("unchecked")
    private ObjectMeta parseObjectMeta(Map<String, Object> response) {
        ObjectMeta meta = new ObjectMeta();
        meta.setCode((String) response.get("code"));
        meta.setLabel((String) response.get("displayName"));

        List<FieldDescriptor> fields = new ArrayList<>();
        List<Map<String, Object>> fieldDefs = (List<Map<String, Object>>) response.get("fieldDefinitions");
        if (fieldDefs != null) {
            for (Map<String, Object> fd : fieldDefs) {
                FieldDescriptor field = new FieldDescriptor();
                field.setCode((String) fd.get("name"));
                field.setLabel((String) fd.get("displayName"));
                field.setDataType(parseDataType((String) fd.get("fieldType")));
                field.setRequired(Boolean.TRUE.equals(fd.get("required")));
                fields.add(field);
            }
        }
        meta.setFields(fields);
        return meta;
    }

    private DataType parseDataType(String type) {
        try {
            return DataType.valueOf(type);
        } catch (Exception e) {
            return DataType.STRING;
        }
    }

    /**
     * 内置示例数据 - 当 ontology-engine 不可用时使用
     */
    public static ObjectMeta getBuiltinSample(String objectCode) {
        return switch (objectCode) {
            case "customer" -> new ObjectMeta("customer", "客户", List.of(
                    new FieldDescriptor("name", "客户名称", DataType.STRING, 100, true, false),
                    new FieldDescriptor("email", "邮箱", DataType.STRING, 200, true, false),
                    new FieldDescriptor("phone", "电话", DataType.STRING, 20, false, false),
                    new FieldDescriptor("totalAmount", "累计金额", DataType.BIG_DECIMAL, null, false, false),
                    new FieldDescriptor("status", "状态", DataType.ENUM, null, true, false),
                    new FieldDescriptor("birthday", "生日", DataType.LOCAL_DATE, null, false, false),
                    new FieldDescriptor("address", "地址", DataType.STRING, 500, false, false),
                    new FieldDescriptor("description", "描述", DataType.STRING, 2000, false, false),
                    new FieldDescriptor("avatar", "头像", DataType.STRING, 500, false, false),
                    new FieldDescriptor("createdAt", "创建时间", DataType.LOCAL_DATE_TIME, null, false, true)
            ));
            case "order" -> new ObjectMeta("order", "订单", List.of(
                    new FieldDescriptor("orderNo", "订单号", DataType.STRING, 50, true, false),
                    new FieldDescriptor("customerName", "客户名称", DataType.STRING, 100, true, false),
                    new FieldDescriptor("amount", "订单金额", DataType.BIG_DECIMAL, null, true, false),
                    new FieldDescriptor("status", "订单状态", DataType.ENUM, null, true, false),
                    new FieldDescriptor("orderDate", "下单日期", DataType.LOCAL_DATE, null, true, false),
                    new FieldDescriptor("deliveryDate", "交付日期", DataType.LOCAL_DATE, null, false, false),
                    new FieldDescriptor("type", "订单类型", DataType.ENUM, null, true, false),
                    new FieldDescriptor("memo", "备注", DataType.STRING, 2000, false, false),
                    new FieldDescriptor("createdAt", "创建时间", DataType.LOCAL_DATE_TIME, null, false, true)
            ));
            case "product" -> new ObjectMeta("product", "产品", List.of(
                    new FieldDescriptor("name", "产品名称", DataType.STRING, 200, true, false),
                    new FieldDescriptor("code", "产品编码", DataType.STRING, 50, true, false),
                    new FieldDescriptor("price", "价格", DataType.BIG_DECIMAL, null, true, false),
                    new FieldDescriptor("category", "分类", DataType.ENUM, null, true, false),
                    new FieldDescriptor("status", "状态", DataType.ENUM, null, true, false),
                    new FieldDescriptor("description", "产品描述", DataType.STRING, 5000, false, false),
                    new FieldDescriptor("image", "产品图片", DataType.STRING, 500, false, false),
                    new FieldDescriptor("stock", "库存", DataType.INTEGER, null, false, false)
            ));
            default -> new ObjectMeta(objectCode, objectCode, List.of(
                    new FieldDescriptor("name", "名称", DataType.STRING, 100, true, false),
                    new FieldDescriptor("status", "状态", DataType.ENUM, null, false, false),
                    new FieldDescriptor("description", "描述", DataType.STRING, 2000, false, false),
                    new FieldDescriptor("createdAt", "创建时间", DataType.LOCAL_DATE_TIME, null, false, true)
            ));
        };
    }
}
