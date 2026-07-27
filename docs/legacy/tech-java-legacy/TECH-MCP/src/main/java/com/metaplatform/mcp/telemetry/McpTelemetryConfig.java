package com.metaplatform.mcp.telemetry;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.observation.ObservationRegistry;
import io.micrometer.observation.aop.ObservedAspect;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.autoconfigure.metrics.MeterRegistryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class McpTelemetryConfig {

    @Bean
    public ObservedAspect observedAspect(ObservationRegistry registry) {
        return new ObservedAspect(registry);
    }

    @Bean
    public MeterRegistryCustomizer<MeterRegistry> commonTags(
            @Value("${spring.application.name:tech-mcp}") String application) {
        return registry -> registry.config().commonTags("application", application);
    }

    @Bean
    public Timer mcpToolExecuteTimer(MeterRegistry registry) {
        return Timer.builder("mcp.tool.execute")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry);
    }

    @Bean
    public Counter mcpToolCallCounter(MeterRegistry registry) {
        return Counter.builder("mcp.tool.calls").register(registry);
    }
}
