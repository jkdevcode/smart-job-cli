import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import openUrl from 'open';
import { scrapeLinkedInJobs } from '../scraper/linkedin.js';
import { writeExcelFile } from '../utils/excelExport.js';
import {
  JOB_STATUSES,
  cleanupJobs,
  filterJobsByRules,
  getJobById,
  getJobsForExport,
  getJobs,
  getJobStats,
  rankJobsByRules,
  saveJobs,
  updateJobStatus
} from '../services/jobService.js';
import { updateEnvValue } from '../utils/envConfig.js';
import {
  formatJobModality,
  JOB_MODALITIES,
  normalizeSearchModality,
  SEARCH_MODALITIES
} from '../utils/modality.js';
import { getDbPath } from '../storage/db.js';

const TABLE_COLUMNS = [
  { key: 'relevance', label: 'Rel', width: 3 },
  { key: 'score', label: 'Score', width: 5 },
  { key: 'id', label: 'ID', width: 4 },
  { key: 'flag', label: 'Flag', width: 4 },
  { key: 'modality', label: 'Modo', width: 7 },
  { key: 'language', label: 'Lang', width: 5 },
  { key: 'location', label: 'Ubicacion', width: 18 },
  { key: 'title', label: 'Titulo', width: 30 },
  { key: 'company', label: 'Empresa', width: 20 },
  { key: 'link', label: 'Link', width: 36 }
];

const VALID_STATUS_LABEL = JOB_STATUSES.join('|');
const VALID_LIST_MODALITY_LABEL = ['all', ...JOB_MODALITIES].join('|');
const EXPORT_FORMATS = Object.freeze(['csv', 'json', 'xlsx']);
const CLEANUP_PREVIEW_LIMIT = 3;

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
    .option('--limit <number>', 'Cantidad maxima total de ofertas a revisar', parseLimitOption)
    .option(
      '--modality <modality>',
      `Modalidad a buscar: ${SEARCH_MODALITIES.join('|')}`,
      parseModalityOption
    )
    .option('--location <location>', 'Ubicacion objetivo para LinkedIn Jobs')
    .option('--remote', 'Atajo para buscar solo ofertas remotas')
    .action(async (options) => {
      try {
        printSection('FETCH');
        const keyword = resolveFetchKeywordLabel(options.keyword);
        const limit = resolveFetchLimit(options.limit);
        const modality = resolveFetchModality(options.modality, options.remote);
        const location = resolveFetchLocation(options.location);

        console.log(chalk.cyan(`Keyword: ${keyword}`));
        console.log(chalk.cyan(`Limite: ${limit}`));
        console.log(chalk.cyan(`Modalidad buscada: ${modality}`));
        console.log(chalk.cyan(`Ubicacion objetivo: ${location}`));
        console.log(chalk.cyan('Publicadas en ultimas 24 horas: si'));
        console.log(chalk.cyan('Abriendo LinkedIn Jobs y extrayendo ofertas...'));

        const jobs = await scrapeLinkedInJobs({
          keyword: options.keyword,
          limit,
          location: options.location,
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
    .command('review')
    .description('Marca una oferta como reviewing.')
    .argument('<id>', 'ID de la oferta')
    .action(async (idValue) => {
      await handleStatusChange(idValue, 'reviewing');
    });

  program
    .command('ignore')
    .description('Marca una oferta como ignorada.')
    .argument('<id>', 'ID de la oferta')
    .action(async (idValue) => {
      await handleStatusChange(idValue, 'ignored');
    });

  program
    .command('open')
    .description('Abre en el navegador la oferta indicada por ID.')
    .argument('<id>', 'ID de la oferta')
    .action(async (idValue) => {
      try {
        const id = parseId(idValue);
        const job = await getJobById(id);

        if (!job) {
          console.error(chalk.red(`No existe ninguna oferta con ID ${id}.`));
          process.exitCode = 1;
          return;
        }

        if (!job.link) {
          console.error(chalk.red(`La oferta ${id} no tiene un link valido para abrir.`));
          process.exitCode = 1;
          return;
        }

        await openUrl(job.link);
        console.log(chalk.green(`Oferta ${id} abierta en el navegador.`));
        console.log(chalk.cyan(`${job.title} | ${job.company}`));
      } catch (error) {
        console.error(chalk.red('No fue posible abrir la oferta.'));
        console.error(chalk.red(error.message));
        process.exitCode = 1;
      }
    });

  program
    .command('stats')
    .description('Muestra estadisticas resumidas de las ofertas guardadas.')
    .action(async () => {
      try {
        const stats = await getJobStats();

        printSection('STATS');
        renderKeyValueRows([
          ['Total ofertas', stats.total],
          ['Nuevas', stats.statuses.new],
          ['Reviewing', stats.statuses.reviewing],
          ['Aplicadas', stats.statuses.applied],
          ['Ignoradas', stats.statuses.ignored]
        ]);
        console.log('');
        renderCountRows('Modalidades', stats.modalityCounts);
        console.log('');
        renderCountRows('Top empresas', stats.topCompanies);
        console.log('');
        renderCountRows('Top locations', stats.topLocations);
      } catch (error) {
        console.error(chalk.red('No fue posible generar las estadisticas.'));
        console.error(chalk.red(error.message));
        process.exitCode = 1;
      }
    });

  program
    .command('export')
    .description('Exporta las ofertas guardadas a CSV, JSON o XLSX.')
    .option('--format <format>', `Formato de salida: ${EXPORT_FORMATS.join('|')}`, parseExportFormatOption, 'xlsx')
    .action(async (options) => {
      try {
        const jobs = await getJobsForExport();
        const filePath = await writeExportFile(jobs, options.format);
        console.log(chalk.green(`Export completado: ${filePath}`));
        console.log(chalk.cyan(`Ofertas exportadas: ${jobs.length}`));
      } catch (error) {
        console.error(chalk.red('No fue posible exportar las ofertas.'));
        console.error(chalk.red(error.message));
        process.exitCode = 1;
      }
    });

  const configCommand = program
    .command('config')
    .description('Muestra o actualiza la configuracion principal del CLI.');

  configCommand.action(() => {
    printSection('CONFIG');
    renderKeyValueRows([
      ['Keyword default', resolveFetchKeywordLabel('')],
      ['Max jobs', resolveFetchLimit()],
      ['Modality default', resolveFetchModality()],
      ['DB path', getDbPath()]
    ]);
  });

  configCommand
    .command('set')
    .description('Actualiza una clave de configuracion en .env.')
    .argument('<key>', 'Clave logica: keyword|max-jobs|modality|db-path')
    .argument('<value>', 'Nuevo valor')
    .action((key, value) => {
      try {
        const configEntry = resolveConfigEntry(key, value);
        const result = updateEnvValue(configEntry.envKey, configEntry.value);
        process.env[configEntry.envKey] = configEntry.value;

        console.log(chalk.green(`Configuracion actualizada: ${configEntry.envKey}`));
        console.log(chalk.cyan(`Valor: ${configEntry.value}`));
        console.log(chalk.cyan(`Archivo: ${result.envPath}`));

        if (result.backupPath) {
          console.log(chalk.cyan(`Backup: ${result.backupPath}`));
        }
      } catch (error) {
        console.error(chalk.red('No fue posible actualizar la configuracion.'));
        console.error(chalk.red(error.message));
        process.exitCode = 1;
      }
    });

  program
    .command('cleanup')
    .description('Elimina ofertas antiguas, invalidas y duplicados extremos.')
    .option('--days <number>', 'Antiguedad maxima en dias para conservar ofertas', parseDaysOption, 45)
    .action(async (options) => {
      try {
        const result = await cleanupJobs({ maxAgeDays: options.days });

        printSection('CLEANUP');
        console.log(chalk.cyan(`Umbral de antiguedad: ${options.days} dias`));
        renderCleanupPreview('Antiguas', result.preview.staleJobs);
        renderCleanupPreview('Invalidas', result.preview.invalidJobs);
        renderCleanupPreview('Duplicadas', result.preview.duplicateJobs);
        console.log('');
        console.log(chalk.green(`Candidatas detectadas: ${result.preview.totalCandidates}`));
        console.log(chalk.green(`Eliminadas: ${result.deleted}`));
        console.log(chalk.green(`Restantes: ${result.remaining}`));
      } catch (error) {
        console.error(chalk.red('No fue posible ejecutar cleanup.'));
        console.error(chalk.red(error.message));
        process.exitCode = 1;
      }
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
      const currentStatusLabel = getStatusPastParticiple(status);
      console.log(chalk.yellow(`La oferta ${id} ya estaba marcada como ${currentStatusLabel}.`));
      return;
    }

    const updated = await updateJobStatus(id, status);

    if (updated === 0) {
      console.log(chalk.yellow(`No se encontro ninguna oferta con ID ${id}.`));
      return;
    }

    const statusLabel = getStatusPastParticiple(status);
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
    score: formatJobScore(job.score),
    id: String(job.id),
    flag: job.hasRedFlags || String(job.redFlags || '').trim() ? '⚠' : '',
    modality: formatJobModality(job.modality),
    language: formatJobLanguage(job.language),
    location: sanitizeDisplayValue(job.location),
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

function renderKeyValueRows(rows) {
  const labelWidth = rows.reduce((maxWidth, [label]) => Math.max(maxWidth, label.length), 0);

  for (const [label, value] of rows) {
    console.log(`${chalk.bold(label.padEnd(labelWidth, ' '))} : ${value}`);
  }
}

function renderCountRows(title, rows) {
  console.log(chalk.bold(title));

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(chalk.yellow('Sin datos.'));
    return;
  }

  const valueWidth = rows.reduce(
    (maxWidth, row) => Math.max(maxWidth, sanitizeDisplayValue(row.value).length),
    0
  );

  for (const row of rows) {
    const value = sanitizeDisplayValue(row.value);
    console.log(`${value.padEnd(valueWidth, ' ')} : ${row.count}`);
  }
}

function renderCleanupPreview(title, rows) {
  console.log('');
  console.log(chalk.bold(`${title}: ${rows.length}`));

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(chalk.yellow('Sin coincidencias.'));
    return;
  }

  for (const row of rows.slice(0, CLEANUP_PREVIEW_LIMIT)) {
    const titleText = sanitizeDisplayValue(row.title);
    const companyText = sanitizeDisplayValue(row.company);
    console.log(`${row.id} | ${titleText} | ${companyText}`);
  }

  if (rows.length > CLEANUP_PREVIEW_LIMIT) {
    console.log(chalk.yellow(`... y ${rows.length - CLEANUP_PREVIEW_LIMIT} mas.`));
  }
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

function resolveFetchKeywordLabel(optionKeyword) {
  const normalizedKeyword = String(optionKeyword || '').trim();

  if (normalizedKeyword) {
    return normalizedKeyword;
  }

  const configuredVariants = splitConfiguredList(process.env.LINKEDIN_KEYWORD_VARIANTS);

  if (configuredVariants.length > 0) {
    return configuredVariants.join(' | ');
  }

  return process.env.LINKEDIN_KEYWORDS || 'nodejs';
}

function resolveFetchLimit(optionLimit) {
  if (Number.isInteger(optionLimit) && optionLimit > 0) {
    return optionLimit;
  }

  const configuredLimit = Number.parseInt(process.env.LINKEDIN_MAX_JOBS ?? '', 10);

  if (!Number.isInteger(configuredLimit) || configuredLimit <= 0) {
    return 50;
  }

  return Math.min(100, configuredLimit);
}

function resolveFetchModality(optionModality, remoteFlag) {
  return normalizeSearchModality(optionModality ?? process.env.LINKEDIN_DEFAULT_MODALITY ?? 'both', remoteFlag);
}

function resolveFetchLocation(optionLocation) {
  const normalizedLocation = String(optionLocation || '').trim();

  if (normalizedLocation) {
    return normalizedLocation;
  }

  const configuredLocations = [
    ...splitConfiguredList(process.env.LINKEDIN_TARGET_LOCATIONS),
    ...splitConfiguredList(process.env.LINKEDIN_COLOMBIA_CITIES)
  ];

  if (configuredLocations.length === 0) {
    return 'sin filtro fijo';
  }

  return configuredLocations.join(' | ');
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

function parseExportFormatOption(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!EXPORT_FORMATS.includes(normalizedValue)) {
    throw new Error(`Formato invalido. Usa uno de: ${EXPORT_FORMATS.join('|')}.`);
  }

  return normalizedValue;
}

function parseDaysOption(value) {
  const parsedValue = Number.parseInt(String(value || '').trim(), 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error('Los dias deben ser un entero positivo.');
  }

  return parsedValue;
}

function printRulesWarning(warning) {
  if (!warning) {
    return;
  }

  console.log(chalk.yellow(`Aviso: ${warning}`));
}

function formatJobLanguage(language) {
  if (language === 'spanish') {
    return 'ES';
  }

  if (language === 'english') {
    return 'EN';
  }

  if (language === 'mixed') {
    return 'MIX';
  }

  return '-';
}

function formatJobScore(score) {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore) || numericScore < 0) {
    return '0';
  }

  return String(Math.round(numericScore));
}

function getStatusPastParticiple(status) {
  if (status === 'applied') {
    return 'aplicada';
  }

  if (status === 'ignored') {
    return 'ignorada';
  }

  if (status === 'reviewing') {
    return 'en revision';
  }

  return status;
}

function splitConfiguredList(value) {
  return String(value || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveConfigEntry(key, value) {
  const normalizedKey = String(key || '').trim().toLowerCase();
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    throw new Error('El valor no puede estar vacio.');
  }

  if (normalizedKey === 'keyword') {
    return { envKey: 'LINKEDIN_KEYWORDS', value: normalizedValue };
  }

  if (normalizedKey === 'max-jobs') {
    const parsedValue = parseLimitOption(normalizedValue);
    return { envKey: 'LINKEDIN_MAX_JOBS', value: String(parsedValue) };
  }

  if (normalizedKey === 'modality') {
    return {
      envKey: 'LINKEDIN_DEFAULT_MODALITY',
      value: normalizeSearchModality(normalizedValue, false)
    };
  }

  if (normalizedKey === 'db-path') {
    return { envKey: 'JOB_DB_PATH', value: normalizedValue };
  }

  throw new Error('Clave invalida. Usa una de: keyword|max-jobs|modality|db-path.');
}

async function writeExportFile(jobs, format) {
  const exportDir = path.resolve(process.cwd(), 'exports');
  const timestamp = createTimestampLabel(new Date());
  const filePath = path.join(exportDir, `jobs-${timestamp}.${format}`);

  fs.mkdirSync(exportDir, { recursive: true });

  if (format === 'json') {
    fs.writeFileSync(filePath, `${JSON.stringify(jobs, null, 2)}\n`, 'utf8');
    return filePath;
  }

  if (format === 'xlsx') {
    await writeExcelFile(jobs, filePath);
    return filePath;
  }

  const headers = ['id', 'title', 'company', 'location', 'modality', 'language', 'status', 'score', 'link'];
  const lines = [headers.join(',')];

  for (const job of jobs) {
    lines.push(
      headers
        .map((header) => escapeCsvValue(job[header]))
        .join(',')
    );
  }

  // Se añade \ufeff al inicio (UTF-8 BOM) para que Excel reconozca los acentos y la eñe correctamente en el CSV.
  fs.writeFileSync(filePath, `\ufeff${lines.join('\n')}\n`, 'utf8');
  return filePath;
}

function createTimestampLabel(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

function escapeCsvValue(value) {
  const stringValue = sanitizeExportValue(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function sanitizeExportValue(value) {
  if (value == null) {
    return '';
  }

  return String(value).replace(/\r?\n/g, ' ').trim();
}
