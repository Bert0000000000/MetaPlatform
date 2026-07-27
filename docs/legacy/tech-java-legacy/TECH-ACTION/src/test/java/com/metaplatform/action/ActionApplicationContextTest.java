package com.metaplatform.action;

import com.metaplatform.action.definition.repository.ActionDefinitionRepository;
import com.metaplatform.action.definition.service.ActionDefinitionService;
import com.metaplatform.action.execution.service.HttpExecutionService;
import com.metaplatform.action.integration.ont.OntologyIntegrationService;
import com.metaplatform.action.orchestration.service.OrchestrationAsyncRunner;
import com.metaplatform.action.orchestration.service.OrchestrationExecutionService;
import com.metaplatform.action.remediation.service.RemediationActionService;
import com.metaplatform.action.trigger.service.ActionTriggerService;
import com.metaplatform.action.trigger.service.EventTriggerConsumer;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.AopProxyUtils;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.SmartLifecycle;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * TECH-ACTION 完整应用上下文启动验证（@SpringBootTest）。
 *
 * <p>验证深度实现引入的新 Bean 与运行时特性能在完整应用上下文中正确装配：
 * <ul>
 *   <li>{@code contextLoads}：完整上下文加载（JPA + WebFlux + Kafka + Async + Scheduling）</li>
 *   <li>{@code orchestrationAsyncRunnerIsAsyncProxy}：@Async 代理生效</li>
 *   <li>{@code orchestrationAsyncRunnerLazyInjected}：@Lazy 打破循环依赖，注入到 OrchestrationExecutionService</li>
 *   <li>{@code eventTriggerConsumerIsSmartLifecycleAndDisabled}：SmartLifecycle 实现 + app.trigger.event.enabled=false 禁用</li>
 *   <li>{@code remediationActionServiceInjected}：RemediationActionService 及其依赖装配</li>
 *   <li>{@code ontologyIntegrationServiceInjected}：OntologyIntegrationService 及 WebClient.Builder 装配</li>
 * </ul>
 */
@SpringBootTest
class ActionApplicationContextTest {

    @Autowired
    ApplicationContext applicationContext;

    @Autowired
    OrchestrationAsyncRunner orchestrationAsyncRunner;

    @Autowired
    OrchestrationExecutionService orchestrationExecutionService;

    @Autowired
    EventTriggerConsumer eventTriggerConsumer;

    @Autowired
    RemediationActionService remediationActionService;

    @Autowired
    OntologyIntegrationService ontologyIntegrationService;

    @Autowired
    ActionDefinitionRepository actionDefinitionRepository;

    @Autowired
    HttpExecutionService httpExecutionService;

    @Autowired
    ActionTriggerService actionTriggerService;

    @Test
    void contextLoads() {
        assertThat(applicationContext).isNotNull();
        assertThat(applicationContext.containsBean("orchestrationAsyncRunner")).isTrue();
        assertThat(applicationContext.containsBean("orchestrationExecutionService")).isTrue();
        assertThat(applicationContext.containsBean("eventTriggerConsumer")).isTrue();
        assertThat(applicationContext.containsBean("remediationActionService")).isTrue();
        assertThat(applicationContext.containsBean("ontologyIntegrationService")).isTrue();
        assertThat(applicationContext.containsBean("actionTriggerService")).isTrue();
    }

    /**
     * 验证 OrchestrationAsyncRunner 是 Spring AOP 代理（@Async 生效）。
     *
     * <p>OrchestrationExecutionService 通过 @Lazy 注入 OrchestrationAsyncRunner，
     * 跨 Bean 调用 run() 时 @Async 才会生效。完整上下文加载 @EnableAsync 后，
     * Spring 会为含 @Async 方法的 Bean 创建 CGLIB 代理。
     */
    @Test
    void orchestrationAsyncRunnerIsAsyncProxy() {
        assertThat(AopUtils.isAopProxy(orchestrationAsyncRunner))
                .as("OrchestrationAsyncRunner 应为 AOP 代理（@Async 生效）")
                .isTrue();
        Class<?> targetClass = AopProxyUtils.ultimateTargetClass(orchestrationAsyncRunner);
        assertThat(targetClass).isEqualTo(OrchestrationAsyncRunner.class);
    }

    /**
     * 验证 @Lazy 注入打破循环依赖。
     *
     * <p>OrchestrationAsyncRunner 构造器注入 OrchestrationExecutionService，
     * 而 OrchestrationExecutionService 用 @Autowired @Lazy 反向注入 OrchestrationAsyncRunner。
     * 验证该字段已注入且是代理对象（@Lazy 会生成代理）。
     */
    @Test
    void orchestrationAsyncRunnerLazyInjected() {
        Object runner = ReflectionTestUtils.getField(
                orchestrationExecutionService, "orchestrationAsyncRunner");
        assertThat(runner)
                .as("OrchestrationExecutionService.orchestrationAsyncRunner 应已通过 @Lazy 注入")
                .isNotNull();
        // @Lazy 注入的应是代理对象
        assertThat(AopUtils.isAopProxy(runner))
                .as("@Lazy 注入的 OrchestrationAsyncRunner 应为代理对象")
                .isTrue();
    }

    /**
     * 验证 EventTriggerConsumer 实现 SmartLifecycle 且在测试环境中被禁用。
     *
     * <p>EventTriggerConsumer 启动时为每个 event topic 创建 Kafka 容器，
     * 测试环境通过 app.trigger.event.enabled=false 禁用，避免连接 Kafka。
     */
    @Test
    void eventTriggerConsumerIsSmartLifecycleAndDisabled() {
        assertThat(eventTriggerConsumer).isInstanceOf(SmartLifecycle.class);
        // SmartLifecycle.start() 在上下文刷新时被调用，由于 enabled=false，
        // running 标志仍为 true（start 方法设 running=true 后直接 return），
        // 但不会创建任何 Kafka 容器。验证 isRunning 返回 true 且没有创建容器。
        assertThat(eventTriggerConsumer.isRunning()).isTrue();
        // 验证没有 Kafka 容器被创建（因为 eventTriggerEnabled=false）
        Object containers = ReflectionTestUtils.getField(eventTriggerConsumer, "containers");
        assertThat(containers).isInstanceOf(java.util.Map.class);
        assertThat(((java.util.Map<?, ?>) containers)).isEmpty();
    }

    /**
     * 验证 RemediationActionService 及其依赖（ActionDefinitionRepository + HttpExecutionService）已装配。
     */
    @Test
    void remediationActionServiceInjected() {
        assertThat(remediationActionService).isNotNull();
        Object repo = ReflectionTestUtils.getField(remediationActionService, "actionDefinitionRepository");
        assertThat(repo).as("RemediationActionService.actionDefinitionRepository 应已注入").isNotNull();
        assertThat(repo).isSameAs(actionDefinitionRepository);
        Object exec = ReflectionTestUtils.getField(remediationActionService, "httpExecutionService");
        assertThat(exec).as("RemediationActionService.httpExecutionService 应已注入").isNotNull();
        assertThat(exec).isSameAs(httpExecutionService);
    }

    /**
     * 验证 OntologyIntegrationService 已装配且 ontBaseUrl 配置正确。
     */
    @Test
    void ontologyIntegrationServiceInjected() {
        assertThat(ontologyIntegrationService).isNotNull();
        Object webClientBuilder = ReflectionTestUtils.getField(
                ontologyIntegrationService, "webClientBuilder");
        assertThat(webClientBuilder)
                .as("OntologyIntegrationService.webClientBuilder 应已注入")
                .isNotNull();
        String ontBaseUrl = (String) ReflectionTestUtils.getField(
                ontologyIntegrationService, "ontBaseUrl");
        assertThat(ontBaseUrl).isEqualTo("http://localhost:8201");
    }
}
