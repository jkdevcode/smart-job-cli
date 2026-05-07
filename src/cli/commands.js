import { Command } from 'commander';
import chalk from 'chalk';
import { scrapeLinkedInJobs } from '../scraper/linkedin.js';
import {
  JOB_STATUSES,
  filterJobsByRules,
  getJobById,
  getJobs,
  rankJobsByRules,
  saveJobs,
  updateJobStatus
} from '../services/jobService.js';
import {
  formatJobModality,
  JOB_MODALITIES,
  normalizeSearchModality,
  SEARCH_MODALITIES
} from '../utils/modality.js';

const TABLE_COLUMNS = [
  { key: 'relevance', label: 'Rel', width: 3 },
  { key: 'id', label: 'ID', width: 4 },
  { key: 'modality', label: 'Modo', width: 7 },
  { key: 'title', label: 'Titulo', width: 42 },
  { key: 'company', label: 'Empresa', width: 28 },
  { key: 'link', label: 'Link', width: 48 }
];

const VALID_STATUS_LABEL = JOB_STATUSES.join('|');
const VALID_LIST_MODALITY_LABEL = ['all', ...JOB_MODALITIES].join('|');

export function createProgram() {
  const program = new Command();

  program
    .name('job-bot')
    .description('CLI para obtener y gestionar ofertas de empleo desde LinkedIn.')
    .version('1.0.0')
    .showHelpAfterError();

  program
    .command('fetch')
    .description('Obtiene ofertas desde LinkedIn y las guarda en SQLite.')
    .option('--keyword <keyword>', 'Keyword de busqueda para LinkedIn Jobs')
    .option('--limit <number>', 'Cantidad maxima de ofertas a revisar', parseLimitOption, 50)
    .option(
      '--modality <modality>',
      `Modalidad a buscar: ${SEARCH_MODALITIES.join('|')}`,
      parseModalityOption,
      'both'
    )
    .option('--remote', 'Atajo para buscar solo ofertas remotas')
    .action(async (options) => {
      try {
        printSection('FETCH');
        const keyword = resolveFetchKeyword(options.keyword);
        const limit = options.limit;
        const modality = normalizeSearchModality(options.modality, options.remote);

        console.log(chalk.cyan(`Keyword: ${keyword}`));
        console.log(chalk.cyan(`Limite: ${limit}`));
        console.log(chalk.cyan(`Modalidad buscada: ${modality}`));
        console.log(chalk.cyan('Publicadas en ultimas 24 horas: si'));
        console.log(chalk.cyan('Abriendo LinkedIn Jobs y extrayendo ofertas...'));

        const jobs = await scrapeLinkedInJobs({
          keyword,
          limit,
          modality,
          remote: options.remote
        });

        if (jobs.length === 0) {
          console.log(
            chalk.yellow(
              'No se encontraron ofertas. LinkedIn puede haber cambiado la estructura de la página.'
            )
          );
          return;
        }

        const filteringResult = await filterJobsByRules(jobs);

        printRulesWarning(filteringResult.warning);

        console.log(chalk.green(`✔ ${jobs.length} encontradas`));
        console.log(chalk.green(`✔ ${filteringResult.jobs.length} despues de filtrar`));

        if (filteringResult.removedCount > 0) {
          console.log(chalk.yellow(`Ofertas descartadas por reglas: ${filteringResult.removedCount}`));
        }

        if (filteringResult.jobs.length === 0) {
          console.log(
            chalk.yellow('No quedaron ofertas despues de aplicar las reglas automaticas.')
          );
          return;
        }

        const inserted = await saveJobs(filteringResult.jobs);
        const duplicates = Math.max(0, filteringResult.jobs.length - inserted);

        console.log(chalk.green(`Ofertas nuevas guardadas: ${inserted}`));
        console.log(chalk.yellow(`Ofertas omitidas por duplicado: ${duplicates}`));
      } catch (error) {
        console.error(chalk.red('No fue posible ejecutar el scraper.'));
        console.error(chalk.red(error.message));
        process.exitCode = 1;
      }
    });

  program
    .command('list')
    .description('Lista ofertas por estado.')
    .option('--status <status>', `Filtra por estado: ${VALID_STATUS_LABEL}`, parseStatusOption, 'new')
    .option(
      '--modality <modality>',
      `Filtra por modalidad: ${VALID_LIST_MODALITY_LABEL}`,
      parseListModalityOption,
      'all'
    )
    .action(async (options) => {
      try {
        const jobs = await getJobs({ status: options.status, modality: options.modality });
        const rankedJobs = await rankJobsByRules(jobs);

        printRulesWarning(rankedJobs.warning);

        if (rankedJobs.jobs.length === 0) {
          const modalitySuffix = options.modality === 'all' ? '' : ` y modalidad "${options.modality}"`;
          console.log(chalk.yellow(`No hay ofertas con estado "${options.status}"${modalitySuffix}.`));
          return;
        }

        const listTitleSuffix = options.modality === 'all' ? '' : ` ${options.modality.toUpperCase()}`;
        printSection(`LIST ${options.status.toUpperCase()}${listTitleSuffix}`);
        renderJobsTable(rankedJobs.jobs);
        console.log(chalk.green(`Mostrando ${rankedJobs.jobs.length} ofertas.`));

        if (rankedJobs.matchedCount === 0) {
          console.log(chalk.yellow('No hay coincidencias positivas segun las reglas actuales.'));
        }
      } catch (error) {
        console.error(chalk.red('No fue posible listar las ofertas.'));
        console.error(chalk.red(error.message));
        process.exitCode = 1;
      }
    });

  program
    .command('apply')
    .description('Marca una oferta como aplicada.')
    .argument('<id>', 'ID de la oferta')
    .action(async (idValue) => {
      await handleStatusChange(idValue, 'applied');
    });

  program
    .command('ignore')
    .description('Marca una oferta como ignorada.')
    .argument('<id>', 'ID de la oferta')
    .action(async (idValue) => {
      await handleStatusChange(idValue, 'ignored');
    });

  return program;
}

async function handleStatusChange(idValue, status) {
  try {
    const id = parseId(idValue);
    const job = await getJobById(id);

    if (!job) {
      console.log(chalk.yellow(`No se encontro ninguna oferta con ID ${id}.`));
      return;
    }

    if (job.status === status) {
      const currentStatusLabel = status === 'applied' ? 'aplicada' : 'ignorada';
      console.log(chalk.yellow(`La oferta ${id} ya estaba marcada como ${currentStatusLabel}.`));
      return;
    }

    const updated = await updateJobStatus(id, status);

    if (updated === 0) {
      console.log(chalk.yellow(`No se encontro ninguna oferta con ID ${id}.`));
      return;
    }

    const statusLabel = status === 'applied' ? 'aplicada' : 'ignorada';
    console.log(chalk.green(`Oferta ${id} marcada como ${statusLabel}.`));
    console.log(chalk.cyan(`${job.title} | ${job.company}`));
  } catch (error) {
    console.error(chalk.red('No fue posible actualizar el estado de la oferta.'));
    console.error(chalk.red(error.message));
    process.exitCode = 1;
  }
}

function parseStatusOption(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!JOB_STATUSES.includes(normalizedValue)) {
    throw new Error(`Estado invalido. Usa uno de: ${VALID_STATUS_LABEL}.`);
  }

  return normalizedValue;
}

function parseId(value) {
  const trimmedValue = String(value || '').trim();

  if (!/^\d+$/.test(trimmedValue)) {
    throw new Error('El ID debe ser un entero positivo.');
  }

  return Number.parseInt(trimmedValue, 10);
}

function printSection(title) {
  const separator = '='.repeat(Math.max(24, title.length + 8));
  console.log(chalk.blue(separator));
  console.log(chalk.bold.white(`  ${title}`));
  console.log(chalk.blue(separator));
}

function renderJobsTable(jobs) {
  const rows = jobs.map((job) => ({
    relevance: job.match ? '⭐' : '',
    id: String(job.id),
    modality: formatJobModality(job.modality),
    title: sanitizeDisplayValue(job.title),
    company: sanitizeDisplayValue(job.company),
    link: shortenLink(job.link)
  }));

  const header = TABLE_COLUMNS.map((column) => formatCell(column.label, column.width)).join(' | ');
  const separator = '-'.repeat(header.length);

  console.log(chalk.blue(separator));
  console.log(chalk.bold(header));
  console.log(chalk.blue(separator));

  for (const row of rows) {
    const line = TABLE_COLUMNS
      .map((column) => formatCell(row[column.key], column.width))
      .join(' | ');

    console.log(line);
  }

  console.log(chalk.blue(separator));
}

function formatCell(value, width) {
  const safeValue = truncate(String(value ?? '-'), width);
  return safeValue.padEnd(width, ' ');
}

function truncate(value, width) {
  if (value.length <= width) {
    return value;
  }

  if (width <= 3) {
    return value.slice(0, width);
  }

  return `${value.slice(0, width - 3)}...`;
}

function shortenLink(link) {
  if (!link) {
    return '-';
  }

  try {
    const url = new URL(link);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, '');
  } catch {
    return link;
  }
}

function sanitizeDisplayValue(value) {
  if (!value) {
    return '-';
  }

  return String(value).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

function resolveFetchKeyword(optionKeyword) {
  const normalizedKeyword = String(optionKeyword || '').trim();

  if (normalizedKeyword) {
    return normalizedKeyword;
  }

  return process.env.LINKEDIN_KEYWORDS || 'nodejs';
}

function parseLimitOption(value) {
  const parsedValue = Number.parseInt(String(value || '').trim(), 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error('El limite debe ser un entero positivo.');
  }

  return Math.min(100, parsedValue);
}

function parseModalityOption(value) {
  return normalizeSearchModality(value, false);
}

function parseListModalityOption(value) {
  const normalizedValue = String(value || 'all').trim().toLowerCase();

  if (normalizedValue === 'all') {
    return normalizedValue;
  }

  if (!JOB_MODALITIES.includes(normalizedValue)) {
    throw new Error(`Modalidad invalida. Usa una de: ${VALID_LIST_MODALITY_LABEL}.`);
  }

  return normalizedValue;
}

function printRulesWarning(warning) {
  if (!warning) {
    return;
  }

  console.log(chalk.yellow(`Aviso: ${warning}`));
}
