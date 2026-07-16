package com.metaplatform.process;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ProcessEngineApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProcessEngineApplication.class, args);
    }
}
