package com.metaplatform.msg.consumer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

/**
 * 事件订阅注解扫描器（P0.4.3）。
 *
 * <p>仅做"发现"职责：扫描所有 Spring Bean 上带 {@link EventTopicListener} 的方法，
 * 把元数据记录到日志供运维观察。
 * 实际 Kafka 订阅由各 listener 方法上自带的 {@code @KafkaListener}
 * 包装方法或独立 Listener 容器承担。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EventConsumerRegistrar implements BeanPostProcessor {

    @SuppressWarnings("unused")
    private final ConsumerFactory<String, Object> consumerFactory;

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        List<Method> methods = findMethodsWith(bean.getClass(), EventTopicListener.class);
        for (Method method : methods) {
            EventTopicListener annotation = AnnotationUtils.findAnnotation(method, EventTopicListener.class);
            if (annotation != null) {
                log.info("[EventConsumerRegistrar] discovered @EventTopicListener on {}.{} topics={} group={} (registration handled by bean container)",
                        beanName, method.getName(),
                        String.join(",", annotation.topics()),
                        annotation.group().isEmpty() ? "<default>" : annotation.group());
            }
        }
        return bean;
    }

    private static <A extends java.lang.annotation.Annotation> List<Method> findMethodsWith(
            Class<?> targetClass, Class<A> annotationType) {
        List<Method> result = new ArrayList<>();
        Class<?> current = targetClass;
        while (current != null && current != Object.class) {
            for (Method m : current.getDeclaredMethods()) {
                if (m.isAnnotationPresent(annotationType)) {
                    result.add(m);
                }
            }
            current = current.getSuperclass();
        }
        return result;
    }
}
