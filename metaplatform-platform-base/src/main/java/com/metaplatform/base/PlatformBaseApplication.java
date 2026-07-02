package com.metaplatform.base;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EnableJpaRepositories
public class PlatformBaseApplication {

    public static void main(String[] args) {
        SpringApplication.run(PlatformBaseApplication.class, args);
    }
}
