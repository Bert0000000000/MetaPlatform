package com.metaplatform.base.integration;

import java.util.List;
import java.util.Map;

/**
 * 集成连接器抽象。每个连接器对接一个外部系统。
 */
public interface Connector {

    /** 连接器唯一标识 */
    String id();

    /** 连接器类型：REST, GRPC, JDBC, etc. */
    String type();

    /** 测试连接是否可用 */
    boolean testConnection();

    /** 拉取数据 */
    List<Map<String, Object>> pull(PullRequest request);

    /** 推送数据 */
    PushResult push(PushRequest request);

    record PullRequest(
        String endpoint,
        Map<String, String> headers,
        Map<String, String> queryParams,
        FieldMapping fieldMapping
    ) {}

    record PushRequest(
        String endpoint,
        Map<String, String> headers,
        Map<String, Object> payload,
        FieldMapping fieldMapping
    ) {}

    record PushResult(
        boolean success,
        int statusCode,
        String responseBody,
        String errorMessage
    ) {}
}
