package com.metaplatform.ragmdm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class RagMdmApplication {

    public static void main(String[] args) {
        SpringApplication.run(RagMdmApplication.class, args);
    }
}
