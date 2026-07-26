package com.metaplatform.agent.verification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;

/**
 * Mock 数据加载器：从 docs/scenarios/mock-data/ 加载 5 个场景的 fixture。
 */
public final class MockFixtures {

    private static final ObjectMapper M = new ObjectMapper();
    private static final String BASE = "/scenarios/mock-data/";

    private MockFixtures() {}

    public static JsonNode load(String name) {
        try (InputStream in = MockFixtures.class.getResourceAsStream(BASE + name)) {
            if (in == null) {
                throw new IllegalStateException("Mock data not found: " + BASE + name);
            }
            return M.readTree(in);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load " + name, e);
        }
    }

    public static String loadAsString(String name) {
        try (InputStream in = MockFixtures.class.getResourceAsStream(BASE + name)) {
            if (in == null) return "";
            return new String(in.readAllBytes(), "UTF-8");
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load " + name, e);
        }
    }
}
