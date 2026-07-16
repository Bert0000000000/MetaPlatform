package com.metaplatform.obs;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.ServletComponentScan;

@SpringBootApplication
@ServletComponentScan
public class IobApplication {

    public static void main(String[] args) {
        SpringApplication.run(IobApplication.class, args);
    }
}