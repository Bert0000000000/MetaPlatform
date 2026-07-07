import { describe, it, expect } from "vitest";
import { simulate } from "../src/ai/simulator.js";

describe("simulator.simulate", () => {
  it("runs the requested number of trials", async () => {
    const r = await simulate({
      arrivalsPerHour: 50,
      serviceTimeSec: 60,
      resources: 3,
      durationHours: 1,
      trials: 7,
    });
    expect(r.trials).toBe(7);
    expect(r.mean).toBeDefined();
    expect(r.mean.utilization).toBeGreaterThanOrEqual(0);
    expect(r.mean.utilization).toBeLessThanOrEqual(1);
  });

  it("reports higher utilization when arrivals exceed service capacity", async () => {
    // Heavy load: 100 arrivals/hr * 60s service / 1 server / 3600s = ~167% utilization expected
    const heavy = await simulate({
      arrivalsPerHour: 100,
      serviceTimeSec: 60,
      resources: 1,
      durationHours: 1,
      trials: 30,
    });
    expect(heavy.mean.utilization).toBeGreaterThan(0.8);

    // Light load: 1 arrival/hr vs 60s service / 1 server / 3600s = ~1.7% util
    const light = await simulate({
      arrivalsPerHour: 1,
      serviceTimeSec: 60,
      resources: 1,
      durationHours: 1,
      trials: 30,
    });
    expect(light.mean.utilization).toBeLessThan(0.1);
  });

  it("returns percentiles", async () => {
    const r = await simulate({
      arrivalsPerHour: 50,
      serviceTimeSec: 120,
      resources: 2,
      durationHours: 1,
      trials: 5,
    });
    expect(r.percentiles.utilization_p50).toBeDefined();
    expect(r.percentiles.wait_p95).toBeGreaterThanOrEqual(0);
  });
});