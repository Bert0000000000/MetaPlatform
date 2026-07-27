package com.metaplatform.msg.consumer;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 事件订阅注解（P0.4.3）。
 *
 * <p>在 Spring Bean 的方法上标注后，{@link EventConsumerRegistrar} 会自动创建
 * Kafka 消费者并绑定到方法。入参支持：</p>
 *
 * <ul>
 *   <li>{@link com.metaplatform.msg.consumer.EventEnvelope}</li>
 *   <li>{@code String}（原始 payload）</li>
 *   <li>{@code Map<String, Object>}</li>
 *   <li>任意自定义 DTO（Jackson 反序列化）</li>
 * </ul>
 *
 * <pre>
 * {@code
 * @Service
 * public class DocumentUploadedListener {
 *     @EventTopicListener(topics = TopologyTopics.DOCUMENT_UPLOADED, group = "agent-extractor")
 *     public void onUploaded(EventEnvelope<Map<String, Object>> env) {
 *         // 启动 Extraction Run
 *     }
 * }
 * }
 * </pre>
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface EventTopicListener {

    /** 要订阅的 topic 列表 */
    String[] topics();

    /** 消费者组（默认类名.方法名） */
    String group() default "";

    /** 并发消费者数 */
    int concurrency() default 1;

    /** 失败重试次数 */
    int retries() default 3;

    /** 重试退避初始间隔（毫秒） */
    long initialBackoffMs() default 500L;

    /** 是否发送至 DLQ */
    boolean dlq() default true;
}
