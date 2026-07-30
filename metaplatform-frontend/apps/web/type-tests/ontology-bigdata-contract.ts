import type {
  BigDataSource,
  CDCTask,
  ETLTask,
  SchedulerTask,
  Metric,
  SourceType,
} from '../src/api/ontology-bigdata';
import {
  listBigDataSources,
  listCDCTasks,
  listETLTasks,
  listSchedulerTasks,
  listMetrics,
} from '../src/api/ontology-bigdata';

const sourceType: SourceType = 'TRINO';
void sourceType;

const sourcePromise: Promise<BigDataSource[]> = listBigDataSources();
const cdcPromise: Promise<CDCTask[]> = listCDCTasks();
const etlPromise: Promise<ETLTask[]> = listETLTasks();
const schedulerPromise: Promise<SchedulerTask[]> = listSchedulerTasks();
const metricPromise: Promise<Metric[]> = listMetrics();
void [sourcePromise, cdcPromise, etlPromise, schedulerPromise, metricPromise];
