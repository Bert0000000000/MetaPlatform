package com.metaplatform.process.infrastructure.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

/**
 * Kafka configuration.
 * Auto-configured by spring-kafka starter.
 * This class can be extended for custom configuration.
 */
@Configuration
@ConditionalOnProperty(name = "spring.kafka.bootstrap-servers")
public class KafkaConfig {
    // Kafka auto-configuration handles most settings
    // Custom producer/consumer configs can be added here
}
