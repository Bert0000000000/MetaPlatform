package com.metaplatform.agent.security;

import org.springframework.boot.actuate.autoconfigure.security.servlet.ManagementWebSecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Excludes the default Spring Security autoconfigs entirely so the acceptance harness can
 * drive the platform without HTTP Basic. Production-grade JWT + tenant filters live in the
 * deployment overlay.
 */
@Configuration
@Primary
@SpringBootApplication(exclude = { SecurityAutoConfiguration.class, ManagementWebSecurityAutoConfiguration.class })
public class SecurityConfig {
}
