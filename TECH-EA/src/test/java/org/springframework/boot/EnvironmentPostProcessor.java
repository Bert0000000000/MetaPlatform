package org.springframework.boot;

/**
 * Test-only shim for spring-cloud-commons 5.0.2 compatibility with Spring Boot 3.5.
 *
 * <p>spring-cloud-commons 5.0.2's {@code ConfigDataMissingEnvironmentPostProcessor}
 * references {@code org.springframework.boot.EnvironmentPostProcessor} (a package that
 * does not exist in Spring Boot 3.5 — the correct location is
 * {@code org.springframework.boot.env.EnvironmentPostProcessor}). This causes
 * {@code NoClassDefFoundError} when {@code SpringFactoriesLoader} tries to instantiate
 * SCA's {@code NacosConfigDataMissingEnvironmentPostProcessor} during
 * {@code ApplicationEnvironmentPreparedEvent}, which happens before any
 * {@code application.yml} is processed.
 *
 * <p>This interface extends the real {@code org.springframework.boot.env.EnvironmentPostProcessor}
 * so that:
 * <ol>
 *   <li>The {@code ConfigDataMissingEnvironmentPostProcessor} class can be loaded
 *       (resolves the {@code NoClassDefFoundError}).</li>
 *   <li>{@code SpringFactoriesLoader.isAssignableFrom} checks pass, because any class
 *       implementing this shim also implements the real interface via inheritance.</li>
 * </ol>
 *
 * <p>Placed under {@code src/test/java} so it never affects production code.
 */
public interface EnvironmentPostProcessor
        extends org.springframework.boot.env.EnvironmentPostProcessor {
}
