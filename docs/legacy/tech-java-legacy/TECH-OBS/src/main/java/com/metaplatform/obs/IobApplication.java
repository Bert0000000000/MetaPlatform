package com.metaplatform.obs;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.ServletComponentScan;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ServletComponentScan
@EnableDiscoveryClient
@EnableScheduling
public class IobApplication {

    public static void main(String[] args) {
        SpringApplication.run(IobApplication.class, args);
    }
}