/** Ontology module routes. */
import { lazy } from 'react';
import { ErrorBoundary } from '@mate/shared';

const OntologyModelingPage = lazy(() => import('../pages/ontology/OntologyModelingPage'));
const OntologyDatacenterPage = lazy(() => import('../pages/ontology/OntologyDatacenterPage'));
const OntologyActionPage = lazy(() => import('../pages/ontology/OntologyActionPage'));
const OntologyGraphPage = lazy(() => import('../pages/ontology/OntologyGraphPage'));

function withBoundary(name: string, element: React.ReactNode) {
  return <ErrorBoundary moduleName={name}>{element}</ErrorBoundary>;
}

export const ontologyRouteElements = {
  OntologyModelingPage: withBoundary('ontology.modeling', <OntologyModelingPage />),
  OntologyDatacenterPage: withBoundary('ontology.datacenter', <OntologyDatacenterPage />),
  OntologyActionPage: withBoundary('ontology.action', <OntologyActionPage />),
  OntologyGraphPage: withBoundary('ontology.graph', <OntologyGraphPage />),
} as const;
