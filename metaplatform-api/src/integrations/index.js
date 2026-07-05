/**
 * Infrastructure Integration Modules - Barrel File
 *
 * Re-exports all infrastructure integration modules for convenient access.
 * Each module gracefully handles missing configuration by providing stub methods.
 *
 * @module integrations
 */

const neo4j = require('./neo4j');
const elasticsearch = require('./elasticsearch');
const milvus = require('./milvus');
const minio = require('./minio');
const keycloak = require('./keycloak');
const argocd = require('./argocd');
const ocr = require('./ocr');
const simulation = require('./simulation');
const quality = require('./quality');

module.exports = {
  neo4j,
  elasticsearch,
  milvus,
  minio,
  keycloak,
  argocd,
  ocr,
  simulation,
  quality,
};
