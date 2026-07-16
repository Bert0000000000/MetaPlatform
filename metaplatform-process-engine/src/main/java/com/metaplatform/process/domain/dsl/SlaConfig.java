package com.metaplatform.process.domain.dsl;

import java.time.Duration;

public class SlaConfig {
    private Duration duration;
    private String escalation;

    public SlaConfig() {}

    public SlaConfig(Duration duration, String escalation) {
        this.duration = duration;
        this.escalation = escalation;
    }

    public Duration getDuration() { return duration; }
    public void setDuration(Duration duration) { this.duration = duration; }
    public String getEscalation() { return escalation; }
    public void setEscalation(String escalation) { this.escalation = escalation; }
}
