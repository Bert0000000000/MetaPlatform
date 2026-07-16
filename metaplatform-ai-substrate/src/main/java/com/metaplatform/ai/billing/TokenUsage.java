package com.metaplatform.ai.billing;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "token_usage")
public class TokenUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private String model;

    @Column(nullable = false)
    private int promptTokens;

    @Column(nullable = false)
    private int completionTokens;

    @Column(nullable = false)
    private int totalTokens;

    @Column(nullable = false)
    private LocalDate usageDate;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected TokenUsage() {} // JPA

    public TokenUsage(UUID tenantId, String model, int promptTokens, int completionTokens) {
        this.tenantId = tenantId;
        this.model = model;
        this.promptTokens = promptTokens;
        this.completionTokens = completionTokens;
        this.totalTokens = promptTokens + completionTokens;
        this.usageDate = LocalDate.now();
        this.createdAt = LocalDateTime.now();
    }

    // Getters
    public Long getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getModel() { return model; }
    public int getPromptTokens() { return promptTokens; }
    public int getCompletionTokens() { return completionTokens; }
    public int getTotalTokens() { return totalTokens; }
    public LocalDate getUsageDate() { return usageDate; }
}
