import { createOrchestrator } from '@serverless-dna/sop-agents';
import { Logger } from '@aws-lambda-powertools/logger';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { enrichQuery } from './enrich-query.js';
import { allSops } from './sops-bundle.js';

const logger = new Logger({ serviceName: 'task-agents' });

const SOPS_DIR = '/tmp/sops';

function writeSopsToDisk() {
  if (existsSync(SOPS_DIR)) return;
  mkdirSync(SOPS_DIR, { recursive: true });
  for (const [filename, content] of Object.entries(allSops)) {
    writeFileSync(`${SOPS_DIR}/${filename}`, content);
  }
  logger.info('Wrote SOPs to disk', { count: Object.keys(allSops).length });
}

export const handler = async (event: { arguments: { query: string } }) => {
  logger.info('Received event', { event });

  writeSopsToDisk();

  const orchestrator = await createOrchestrator({
    directory: SOPS_DIR,
  });

  const enrichedQuery = enrichQuery(event.arguments.query, new Date());

  logger.info('Invoking orchestrator', { enrichedQuery });

  const result = await orchestrator.invoke(enrichedQuery);

  logger.info('Orchestrator result', { result });

  return result;
};
