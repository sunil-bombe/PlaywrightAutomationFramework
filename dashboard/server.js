/**
 * Playwright Dashboard — server.js
 * Dependencies: express, glob
 *
 * Architecture:
 *  - Server spawns playwright directly (tracks exit code + status)
 *  - A separate PS window is opened to display live output via "npx playwright test ... | Tee-Object"
 *  - Browser polls /api/runs every 3s to get real status updates
 */

const express       = require('express');
const path          = require('path');
const fs            = require('fs');
const { spawn }     = require('child_process');
const { glob }      = require('glob');

const app  = express();
const PORT = 3000;

const PROJECT_ROOT  = path.resolve(__dirname, '..');
const REPORT_INDEX  = path.join(PROJECT_ROOT, 'playwright-report', 'index.html');

// ── In-memory run store ──────────────────
// { id, label, suite, modeLabel, status: 'running'|'done'|'failed', startTime, endTime, exitCode }
let runs    = [];
let runSeq  = 0;

// ── Concurrency limits ────────────────────
const LIMITS = {
  maxSpecs:        4,   // max spec runs at the same time
  maxSuites:       2,   // max suite runs at the same time
  maxTotalWorkers: 6,   // max total workers across all running suites
};

function getRunningStats() {
  const running = runs.filter(r => r.status === 'running');
  const specs   = running.filter(r => r.label.startsWith('[SPEC]'));
  const suites  = running.filter(r => r.label.startsWith('[SUITE]'));
  const totalWorkers = suites.reduce((sum, r) => {
    const m = r.modeLabel.match(/w(\d+)/);
    return sum + (m ? parseInt(m[1]) : 1);
  }, 0);
  return { running, specs, suites, totalWorkers };
}

function checkLimits(type, workers) {
  const { specs, suites, totalWorkers } = getRunningStats();
  if (type === 'spec') {
    if (specs.length >= LIMITS.maxSpecs) {
      return `Too many specs running (${specs.length}/${LIMITS.maxSpecs} max). Wait for one to finish.`;
    }
  }
  if (type === 'suite') {
    if (suites.length >= LIMITS.maxSuites) {
      return `Too many suites running (${suites.length}/${LIMITS.maxSuites} max). Wait for one to finish.`;
    }
    const projectedWorkers = totalWorkers + (workers || 2);
    if (projectedWorkers > LIMITS.maxTotalWorkers) {
      return `Worker limit exceeded: ${totalWorkers} used + ${workers || 2} requested = ${projectedWorkers} (max ${LIMITS.maxTotalWorkers}).`;
    }
  }
  return null; // OK
}

// ─────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────
// Suite scanner
// ─────────────────────────────────────────
async function scanSuites() {
  const files = await glob('suites/**/e2e/*.spec.ts', { cwd: PROJECT_ROOT, posix: true });
  const map   = {};
  for (const file of files) {
    const parts = file.split('/');
    const dir   = parts[1];
    const spec  = parts[3];
    if (!map[dir]) {
      map[dir] = {
        id:     dir,
        name:   dir,
        short:  dir, // keep full folder name
        e2eDir: `suites/${dir}/e2e`,
        specs:  [],
      };
    }
    map[dir].specs.push(spec);
  }
  const suites = Object.values(map);
  suites.sort((a, b) => a.name.localeCompare(b.name));
  suites.forEach(s => s.specs.sort());
  return suites;
}


// ─────────────────────────────────────────
// API: GET /api/meta
// Returns project metadata: env, versions
// ─────────────────────────────────────────
app.get('/api/meta', (req, res) => {
  // Read root package.json for framework version
  let frameworkVersion = 'N/A';
  let playwrightVersion = 'N/A';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
    frameworkVersion  = pkg.version || 'N/A';
    const pwVer = (pkg.dependencies && pkg.dependencies['@playwright/test'])
               || (pkg.devDependencies && pkg.devDependencies['@playwright/test'])
               || 'N/A';
    playwrightVersion = pwVer.replace(/[^\d.]/g, '') || pwVer;
  } catch (_) {}

  // Detect environment from suite folder names
  // Generic: works with any naming convention
  // e.g. S4_SIT_AUTO_MM01 → SIT, QA_REGRESSION_SUITE → QA_REGRESSION, UAT_AUTO_LOGIN → UAT
  let environment = 'N/A';
  try {
    const entries = fs.readdirSync(path.join(PROJECT_ROOT, 'suites'));
    const allNames = entries.filter(e => !e.startsWith('.')).join(' ');
    // Try known patterns first
    const m = allNames.match(/[_\-]?(SIT|QAS|UAT|PRD|DEV|QA|PROD|STAGING|REGRESSION)[_\-]/i);
    if (m) {
      environment = m[1].toUpperCase();
    } else {
      // Fallback: first meaningful segment of first folder
      const first = entries.filter(e => !e.startsWith('.')).sort()[0];
      if (first) environment = first.split(/[_\-]/)[0];
    }
  } catch (_) {}

  res.json({
    ok: true,
    product:           'WebApp',
    environment,
    frameworkVersion,
    playwrightVersion,
  });
});

// ─────────────────────────────────────────
// API: GET /api/suites
// ─────────────────────────────────────────
app.get('/api/suites', async (req, res) => {
  try {
    res.json({ ok: true, suites: await scanSuites() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// API: GET /api/runs
// Browser polls this every 3s to get real status
// ─────────────────────────────────────────
app.get('/api/runs', (req, res) => {
  res.json({ ok: true, runs });
});

// ─────────────────────────────────────────
// API: GET /api/limits
// Returns current usage vs limits for UI status bar
// ─────────────────────────────────────────
app.get('/api/limits', (req, res) => {
  const { specs, suites, totalWorkers } = getRunningStats();
  res.json({
    ok: true,
    limits:  LIMITS,
    current: {
      specs:        specs.length,
      suites:       suites.length,
      totalWorkers: totalWorkers,
    },
  });
});

// ─────────────────────────────────────────
// API: GET /api/report-status
// ─────────────────────────────────────────
app.get('/api/report-status', (req, res) => {
  res.json({ ok: true, available: fs.existsSync(REPORT_INDEX) });
});

// ─────────────────────────────────────────
// API: POST /api/show-report
// ─────────────────────────────────────────
app.post('/api/show-report', (req, res) => {
  if (!fs.existsSync(REPORT_INDEX)) {
    return res.status(404).json({ ok: false, error: 'No report found. Run a test first.' });
  }
  spawnPsWindow('[REPORT] Playwright HTML Report', 'npx playwright show-report playwright-report');
  res.json({ ok: true });
});

// ─────────────────────────────────────────
// API: POST /api/run
// ─────────────────────────────────────────
app.post('/api/run', (req, res) => {
  const { type, suiteName, specFile, mode, workers } = req.body;
  if (!type || !suiteName) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const testTarget = type === 'suite'
    ? `suites/${suiteName}/e2e`
    : `suites/${suiteName}/e2e/${specFile}`;

  const args = [
    'playwright', 'test', testTarget,
    '--config', 'playwright.config.ts',
  ];
  if (type === 'suite') {
    args.push(`--workers=${workers || 2}`);
  } else if (mode === 'headed') {
    args.push('--headed');
  }

  const label      = type === 'suite' ? `[SUITE] ${suiteName}` : `[SPEC]  ${specFile}`;
  const modeLabel  = type === 'suite' ? `headless · w${workers || 2}` : (mode || 'headless');

  // ── Check concurrency limits ──
  const limitError = checkLimits(type, workers);
  if (limitError) {
    return res.status(429).json({ ok: false, error: limitError });
  }

  // Register run entry immediately
  const run = {
    id:         ++runSeq,
    label,
    suite:      suiteName.replace(/^S4_(SIT|QAS)_AUTO_/, ''),
    modeLabel,
    status:     'running',
    startTime:  Date.now(),
    endTime:    null,
    exitCode:   null,
  };
  runs.unshift(run);

  // ── Spawn playwright via npx (tracked process) ──
  const pw = spawn('npx', args, {
    cwd:   PROJECT_ROOT,
    shell: true,           // needed on Windows for npx
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Collect output to a temp log file so PS window can tail it
  const logFile = path.join(PROJECT_ROOT, `_pw_log_${run.id}.txt`);
  const logStream = fs.createWriteStream(logFile, { flags: 'w' });
  pw.stdout.pipe(logStream);
  pw.stderr.pipe(logStream);

  // Open PS window that tails the log file
  spawnPsWindow(label, buildTailCommand(logFile, run.id));

  pw.on('close', (code) => {
    logStream.end();
    run.status   = (code === 0) ? 'done' : 'failed';
    run.exitCode = code;
    run.endTime  = Date.now();
    console.log(`[run #${run.id}] ${label} → exit ${code} (${run.status})`);

    // Write sentinel so PS tail-window knows to stop
    try {
      fs.appendFileSync(logFile, `\n\nPLAYWRIGHT_DONE_${code}\n`);
    } catch (_) {}
  });

  pw.on('error', (err) => {
    logStream.end();
    run.status  = 'failed';
    run.endTime = Date.now();
    console.error(`[run #${run.id}] spawn error:`, err.message);
  });

  console.log(`[run #${run.id}] Started: ${label}`);
  res.json({ ok: true, runId: run.id, label });
});

// ─────────────────────────────────────────
// Helper: build PS tail command
// Tails log file until sentinel appears, then shows summary
// ─────────────────────────────────────────
function buildTailCommand(logFile, runId) {
  const logPs = logFile.replace(/\\/g, '\\\\');
  return [
    // Wait for log file to exist (up to 10s)
    `$logFile = '${logPs}'`,
    `$waited = 0`,
    `while (-not (Test-Path $logFile) -and $waited -lt 50) { Start-Sleep -Milliseconds 200; $waited++ }`,
    // Stream file content, poll for new lines every 300ms
    `$pos = 0`,
    `$exitCode = $null`,
    `$done = $false`,
    `while (-not $done) {`,
    `  $content = Get-Content $logFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue`,
    `  if ($content -ne $null) {`,
    `    $newText = $content.Substring($pos)`,
    `    if ($newText.Length -gt 0) { Write-Host $newText -NoNewline; $pos = $content.Length }`,
    `    if ($content -match 'PLAYWRIGHT_DONE_(\\d+)') {`,
    `      $exitCode = $Matches[1]`,
    `      $done = $true`,
    `    }`,
    `  }`,
    `  if (-not $done) { Start-Sleep -Milliseconds 300 }`,
    `}`,
    // Show result
    `Write-Host ''`,
    `Write-Host '---------------------------------' -ForegroundColor DarkGray`,
    `if ($exitCode -eq '0') {`,
    `  Write-Host '  PASSED' -ForegroundColor Green -NoNewline`,
    `  Write-Host '  All tests passed.' -ForegroundColor White`,
    `} else {`,
    `  Write-Host '  FAILED' -ForegroundColor Red -NoNewline`,
    `  Write-Host "  Tests finished with exit code $exitCode." -ForegroundColor White`,
    `}`,
    `Write-Host '---------------------------------' -ForegroundColor DarkGray`,
    `Write-Host 'Press ENTER to close this window...' -ForegroundColor Gray`,
    `Read-Host | Out-Null`,
    // Cleanup log file
    `Remove-Item $logFile -ErrorAction SilentlyContinue`,
  ].join('\r\n');
}

// ─────────────────────────────────────────
// Helper: open a new detached PS window
// Uses -EncodedCommand (Base64 UTF-16LE) to avoid:
//   1. Quote escaping issues with -Command
//   2. ConstrainedLanguage policy blocking -File (.ps1)
// ─────────────────────────────────────────
function spawnPsWindow(title, psCommands) {
  const safeTitle = title.replace(/'/g, "''");
  const safeRoot  = PROJECT_ROOT.replace(/\\/g, '/').replace(/'/g, "''");

  // ConstrainedLanguage mode: cannot set properties or invoke methods
  // Only use basic PS cmdlets: Set-Location, Write-Host, Get-Content, Start-Sleep, Remove-Item
  const script = [
    `Set-Location '${safeRoot}'`,
    psCommands,
  ].join('\n');

  // Encode as UTF-16LE Base64 - required format for PS -EncodedCommand
  const encoded = Buffer.from(script, 'utf16le').toString('base64');

  const child = spawn(
    'cmd.exe',
    ['/c', 'start', 'powershell.exe', '-NoExit', '-EncodedCommand', encoded],
    { cwd: PROJECT_ROOT, detached: false, stdio: 'ignore' }
  );
  child.unref();
}

// ─────────────────────────────────────────
// Fallback
// ─────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─────────────────────────────────────────
// Start
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  🎭 Playwright Dashboard');
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log(`  ➜  Project root: ${PROJECT_ROOT}`);
  console.log('');
});
