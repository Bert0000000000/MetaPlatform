package com.metaplatform.ont;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@EnableDiscoveryClient
@ComponentScan(basePackages = {"com.metaplatform.ont", "com.metaplatform.iam.client"})
public class OntApplication {

    public static void main(String[] args) {
        SpringApplication.run(OntApplication.class, args);
    }
}
