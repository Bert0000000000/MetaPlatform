package com.metaplatform.wfe;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WfeApplication {

    public static void main(String[] args) {
        SpringApplication.run(WfeApplication.class, args);
    }
}
