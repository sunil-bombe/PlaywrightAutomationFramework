#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const isWindows = process.platform === 'win32';
const npxCommand = isWindows ? 'npx.cmd' : 'npx';

function runCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', (error) => {
      reject(new Error(`${label} failed: ${error.message}`));
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });
  });
}

function cleanDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

async function main() {
  const resultsDir = path.join(rootDir, 'allure-results');
  const reportDir = path.join(rootDir, 'allure-report');

  cleanDirectory(resultsDir);
  cleanDirectory(reportDir);

  console.log('Running Playwright tests...');
  await runCommand(npxCommand, ['cucumber-js','--parallel','2', '--retry','2', '--format','html:cucumber-report.html'], 'Playwright test run');

  if (!fs.existsSync(resultsDir)) {
    throw new Error('No allure results were generated.');
  }

  console.log('Generating Allure report...');
  await runCommand(
    npxCommand,
    ['allure', 'generate', 'allure-results', '--clean', '-o', 'allure-report'],
    'Allure report generation'
  );

  console.log('Opening Allure report...');
   await runCommand(
    npxCommand,
    ['allure', 'serve', 'allure-results'],
    'Opening Allure report generation'
  );

  if (isWindows) {
    await runCommand('cmd', ['/c', 'start', '', reportPath], 'Opening Allure report');
  } else if (process.platform === 'darwin') {
    await runCommand('open', [reportPath], 'Opening Allure report');
  } else {
    await runCommand('xdg-open', [reportPath], 'Opening Allure report');
  }
  console.log('Runner finished successfully.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
