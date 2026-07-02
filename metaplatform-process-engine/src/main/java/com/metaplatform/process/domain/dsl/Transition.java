package com.metaplatform.process.domain.dsl;

public class Transition {
    private String from;
    private String to;
    private String condition;

    public Transition() {}

    public Transition(String from, String to) {
        this.from = from;
        this.to = to;
    }

    public Transition(String from, String to, String condition) {
        this.from = from;
        this.to = to;
        this.condition = condition;
    }

    public String getFrom() { return from; }
    public void setFrom(String from) { this.from = from; }
    public String getTo() { return to; }
    public void setTo(String to) { this.to = to; }
    public String getCondition() { return condition; }
    public void setCondition(String condition) { this.condition = condition; }
}
