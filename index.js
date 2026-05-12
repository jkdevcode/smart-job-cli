#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { createProgram } from './src/cli/commands.js';
import { refreshStoredJobInsights } from './src/services/jobService.js';
import { initDB } from './src/storage/db.js';

async function main() {
  try {
    await initDB();
    await refreshStoredJobInsights();

    const program = createProgram();
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red('Error fatal al iniciar el CLI.'));
    console.error(chalk.red(error.message));
    process.exitCode = 1;
  }
}

await main();
