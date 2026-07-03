import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Ontology Engine: entity-types, object-types, object-instances, nl-modeling, ai
      "/api/v1/entity-types": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      "/api/v1/object-types": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      "/api/v1/object-instances": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      "/api/v1/nl-modeling": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Dialogue: sessions, messages
      "/api/v1/dialogue": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Capabilities: list, execute, pipeline
      "/api/v1/capabilities": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Integration: connectors, sync, test
      "/api/v1/integration": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Knowledge base
      "/api/v1/knowledge": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      "/api/v1/billing": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Security: RBAC, audit
      "/api/v1/security": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Lineage
      "/api/v1/lineage": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Processes
      "/api/v1/processes": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Agents
      "/api/v1/agents": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Ontology
      "/api/v1/ontology": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Data sync
      "/api/v1/data-sync": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // MDM
      "/api/v1/mdm": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Multimodal
      "/api/v1/multimodal": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Files
      "/api/v1/files": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Relationships
      "/api/v1/relationships": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
      // Page Generator: page-configs, pages, page-templates
      "/api/v1/page": {
        target: "http://localhost:8083",
        changeOrigin: true,
      },
      // Fallback to page-generator for any other /api
      "/api": {
        target: "http://localhost:8083",
        changeOrigin: true,
      },
    },
  },
});
