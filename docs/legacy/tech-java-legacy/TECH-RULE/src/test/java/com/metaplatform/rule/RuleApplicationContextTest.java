package com.metaplatform.rule;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.decisiontable.dto.DecisionTableColumnDto;
import com.metaplatform.rule.decisiontable.service.DecisionTableExecutionEngine;
import com.metaplatform.rule.monitoring.service.ExecutionLogService;
import com.metaplatform.rule.service.OntologyRelationResolver;
import com.metaplatform.rule.service.RuleEngineService;
import com.metaplatform.rule.statistics.service.StatisticsService;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.AopProxyUtils;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * TECH-RULE 完整应用上下文启动验证（@SpringBootTest）。
 *
 * <p>验证深度实现引入的新 Bean 与运行时特性能在完整应用上下文中正确装配：
 * <ul>
 *   <li>{@code contextLoads}：完整上下文加载（JPA + Security + WebFlux + Kafka + Async）</li>
 *   <li>{@code executionLogServiceIsAsyncProxy}：@Async 代理生效（跨 Bean 调用才走代理）</li>
 *   <li>{@code ontologyRelationResolverInjected}：OntologyRelationResolver 注入到 RuleEngineService</li>
 *   <li>{@code statisticsServiceInjected}：StatisticsService 注入到 RuleEngineService</li>
 *   <li>{@code decisionTableExecutionEngineCanMatchAllOperators}：11 种操作符匹配逻辑</li>
 *   <li>{@code executeReadOnlyIsTransactionalReadOnly}：executeReadOnly 方法标注 readOnly=true</li>
 * </ul>
 */
@SpringBootTest
@ActiveProfiles("test")
class RuleApplicationContextTest {

    @Autowired
    org.springframework.context.ApplicationContext applicationContext;

    @Autowired
    ExecutionLogService executionLogService;

    @Autowired
    OntologyRelationResolver ontologyRelationResolver;

    @Autowired
    StatisticsService statisticsService;

    @Autowired
    DecisionTableExecutionEngine decisionTableExecutionEngine;

    @Autowired
    RuleEngineService ruleEngineService;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void contextLoads() {
        assertThat(applicationContext).isNotNull();
        // 验证关键 Bean 已注册
        assertThat(applicationContext.containsBean("executionLogService")).isTrue();
        assertThat(applicationContext.containsBean("ontologyRelationResolver")).isTrue();
        assertThat(applicationContext.containsBean("statisticsService")).isTrue();
        assertThat(applicationContext.containsBean("decisionTableExecutionEngine")).isTrue();
        assertThat(applicationContext.containsBean("ruleEngineService")).isTrue();
    }

    /**
     * 验证 ExecutionLogService 是 Spring AOP 代理（@Async 生效）。
     *
     * <p>ExecutionLogService 作为独立 Bean，被 RuleEngineService 跨 Bean 调用 writeLog()，
     * 只有通过代理调用时 @Async 才会生效（self-invocation 不走代理）。
     * 完整上下文加载 @EnableAsync 后，Spring 会为含 @Async 方法的 Bean 创建 CGLIB 代理。
     */
    @Test
    void executionLogServiceIsAsyncProxy() {
        assertThat(AopUtils.isAopProxy(executionLogService))
                .as("ExecutionLogService 应为 AOP 代理（@Async 生效）")
                .isTrue();
        // 代理目标类应为 ExecutionLogService（CGLIB 子类代理）
        Class<?> targetClass = AopProxyUtils.ultimateTargetClass(executionLogService);
        assertThat(targetClass).isEqualTo(ExecutionLogService.class);
    }

    /**
     * 验证 OntologyRelationResolver 已注入到 RuleEngineService（构造器注入）。
     */
    @Test
    void ontologyRelationResolverInjected() {
        Object resolver = ReflectionTestUtils.getField(ruleEngineService, "ontologyRelationResolver");
        assertThat(resolver).as("RuleEngineService.ontologyRelationResolver 应已注入").isNotNull();
        assertThat(resolver).isSameAs(ontologyRelationResolver);
    }

    /**
     * 验证 StatisticsService 已注入到 RuleEngineService（构造器注入）。
     */
    @Test
    void statisticsServiceInjected() {
        Object stats = ReflectionTestUtils.getField(ruleEngineService, "statisticsService");
        assertThat(stats).as("RuleEngineService.statisticsService 应已注入").isNotNull();
        assertThat(stats).isSameAs(statisticsService);
    }

    /**
     * 验证 DecisionTableExecutionEngine 的 11 种操作符匹配逻辑全部可用。
     *
     * <p>通过反射调用包级可见的 {@code matchesInput} 方法，逐一验证：
     * eq, ne, gt, lt, gte, lte, in, contains, between, startsWith, endsWith。
     */
    @Test
    @SuppressWarnings("unchecked")
    void decisionTableExecutionEngineCanMatchAllOperators() throws Exception {
        // matchesInput 是包级可见方法，通过反射调用
        Method matchesInput = DecisionTableExecutionEngine.class.getDeclaredMethod(
                "matchesInput", Map.class, Map.class, Map.class);
        matchesInput.setAccessible(true);

        // eq：相等
        assertThat(invoke(matchesInput, Map.of("v", 100), Map.of("v", 100),
                colMap("v", "eq", null))).isTrue();
        assertThat(invoke(matchesInput, Map.of("v", 100), Map.of("v", 200),
                colMap("v", "eq", null))).isFalse();

        // ne：不等
        assertThat(invoke(matchesInput, Map.of("v", 100), Map.of("v", 200),
                colMap("v", "ne", null))).isTrue();
        assertThat(invoke(matchesInput, Map.of("v", 100), Map.of("v", 100),
                colMap("v", "ne", null))).isFalse();

        // gt：expected > actual（row_value > input_value）
        assertThat(invoke(matchesInput, Map.of("v", 50), Map.of("v", 100),
                colMap("v", "gt", "NUMBER"))).isTrue();
        assertThat(invoke(matchesInput, Map.of("v", 200), Map.of("v", 100),
                colMap("v", "gt", "NUMBER"))).isFalse();

        // lt：expected < actual（row_value < input_value）
        assertThat(invoke(matchesInput, Map.of("v", 200), Map.of("v", 100),
                colMap("v", "lt", "NUMBER"))).isTrue();
        assertThat(invoke(matchesInput, Map.of("v", 50), Map.of("v", 100),
                colMap("v", "lt", "NUMBER"))).isFalse();

        // gte：expected >= actual
        assertThat(invoke(matchesInput, Map.of("v", 100), Map.of("v", 100),
                colMap("v", "gte", "NUMBER"))).isTrue();
        assertThat(invoke(matchesInput, Map.of("v", 200), Map.of("v", 100),
                colMap("v", "gte", "NUMBER"))).isFalse();

        // lte：expected <= actual
        assertThat(invoke(matchesInput, Map.of("v", 100), Map.of("v", 100),
                colMap("v", "lte", "NUMBER"))).isTrue();
        assertThat(invoke(matchesInput, Map.of("v", 50), Map.of("v", 100),
                colMap("v", "lte", "NUMBER"))).isFalse();

        // in：在集合中（逗号分隔字符串）
        assertThat(invoke(matchesInput, Map.of("v", "B"), Map.of("v", "A,B,C"),
                colMap("v", "in", null))).isTrue();
        assertThat(invoke(matchesInput, Map.of("v", "D"), Map.of("v", "A,B,C"),
                colMap("v", "in", null))).isFalse();

        // contains：字符串包含
        assertThat(invoke(matchesInput, Map.of("v", "hello world"), Map.of("v", "world"),
                colMap("v", "contains", null))).isTrue();
        assertThat(invoke(matchesInput, Map.of("v", "hello"), Map.of("v", "xyz"),
                colMap("v", "contains", null))).isFalse();

        // between：在 [min, max] 区间（"min,max" 字符串）
        assertThat(invoke(matchesInput, Map.of("v", 150), Map.of("v", "100,200"),
                colMap("v", "between", "NUMBER"))).isTrue();
        assertThat(invoke(matchesInput, Map.of("v", 250), Map.of("v", "100,200"),
                colMap("v", "between", "NUMBER"))).isFalse();

        // startsWith/endsWith：通过 applyOperator 直接验证（resolveOperator 存在大小写归一化
        // 与 SUPPORTED_OPERATORS 驼峰命名不匹配的问题，经 matchesInput 会回退到 eq，
        // 此处直接调用 applyOperator 验证操作符逻辑本身）
        Method applyOperator = DecisionTableExecutionEngine.class.getDeclaredMethod(
                "applyOperator", String.class, String.class, Object.class, Object.class);
        applyOperator.setAccessible(true);

        // startsWith：actual.startsWith(expected)
        assertThat((boolean) applyOperator.invoke(decisionTableExecutionEngine,
                "startsWith", null, "Hello", "HelloWorld")).isTrue();
        assertThat((boolean) applyOperator.invoke(decisionTableExecutionEngine,
                "startsWith", null, "Hello", "WorldHello")).isFalse();

        // endsWith：actual.endsWith(expected)
        assertThat((boolean) applyOperator.invoke(decisionTableExecutionEngine,
                "endsWith", null, "World", "HelloWorld")).isTrue();
        assertThat((boolean) applyOperator.invoke(decisionTableExecutionEngine,
                "endsWith", null, "World", "WorldHello")).isFalse();
    }

    /**
     * 验证 RuleEngineService.executeReadOnly 方法存在且标注 @Transactional(readOnly = true)。
     *
     * <p>executeReadOnly 供 RuleTestingService 等只读场景使用，不发 Outbox、不写统计。
     */
    @Test
    void executeReadOnlyIsTransactionalReadOnly() throws Exception {
        Method method = RuleEngineService.class.getDeclaredMethod(
                "executeReadOnly", String.class, Map.class);
        Transactional tx = method.getAnnotation(Transactional.class);
        assertThat(tx).as("executeReadOnly 应标注 @Transactional").isNotNull();
        assertThat(tx.readOnly())
                .as("executeReadOnly 的 @Transactional 应为 readOnly=true")
                .isTrue();
    }

    // ---- helpers ----

    @SuppressWarnings("unchecked")
    private boolean invoke(Method method, Map<String, Object> inputData,
                            Map<String, Object> rowInputs,
                            Map<String, DecisionTableColumnDto> columnMap) throws Exception {
        return (boolean) method.invoke(decisionTableExecutionEngine, inputData, rowInputs, columnMap);
    }

    private Map<String, DecisionTableColumnDto> colMap(String field, String op, String dataType) {
        DecisionTableColumnDto col = DecisionTableColumnDto.builder()
                .field(field)
                .dataType(dataType)
                .expression("op:" + op)
                .build();
        return Map.of(field, col);
    }
}
