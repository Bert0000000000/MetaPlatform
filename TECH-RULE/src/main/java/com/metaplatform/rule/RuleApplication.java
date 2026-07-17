package com.metaplatform.rule;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RuleApplication {

    public static void main(String[] args) {
        SpringApplication.run(RuleApplication.class, args);
    }
}
