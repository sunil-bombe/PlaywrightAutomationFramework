/**
 * Playwright Dashboard — server.js
 * Dependencies: express, glob
 *
 * Architecture:
 *  - Server spawns playwright directly (tracks exit code + status)
 *  - A separate terminal window is opened to display live output via a tail script
 *      - Windows  → PowerShell window (-EncodedCommand)
 *      - macOS    → Terminal.app window (via osascript), tailing a temp .sh script
 *  - Browser polls /api/runs every 3s to get real status updates
 */

const express       = require('express');
const path          = require('path');
const fs            = require('fs');
const os            = require('os');
const { spawn }     = require('child_process');
const { glob }      = require('glob');

const app  = express();
const PORT = 3000;

const PROJECT_ROOT  = path.resolve(__dirname, '..');
const REPORT_INDEX  = path.join(PROJECT_ROOT, 'playwright-report', 'index.html');

// ── Platform detection ────────────────────
const IS_WINDOWS = process.platform === 'win32';
const IS_MAC     = process.platform === 'darwin';

// ── Config file auto-detection ────────────
// Don't hardcode "playwright.config.ts" — different projects use .ts/.js/.mjs/.cts,
// and mismatches here cause "config does not exist" errors from Playwright itself.
const CONFIG_CANDIDATES = [
  'playwright.config.ts',
  'playwright.config.js',
  'playwright.config.mjs',
  'playwright.config.cts',
  'playwright.config.mts',
];

function findConfigFile() {
  for (const name of CONFIG_CANDIDATES) {
    if (fs.existsSync(path.join(PROJECT_ROOT, name))) return name;
  }
  return null; // let Playwright auto-resolve if we can't find one
}

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
  const files = await glob('suites/**/e2e/*.spec.{ts,js}', { cwd: PROJECT_ROOT, posix: true });
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
    platform:          IS_MAC ? 'mac' : (IS_WINDOWS ? 'windows' : 'other'),
    configFile:        findConfigFile(), // null if none of the common names were found
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
  spawnTerminalWindow('[REPORT] Playwright HTML Report', 'npx playwright show-report playwright-report');
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

  const configFile = findConfigFile();
  const args = [
    'playwright', 'test', testTarget,
  ];
  if (configFile) {
    args.push('--config', configFile);
  } // else: no known config filename found — let Playwright auto-resolve its own default
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
  // shell:true is needed on Windows for npx.cmd resolution; harmless on macOS/Linux too.
  const pw = spawn('npx', args, {
    cwd:   PROJECT_ROOT,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Collect output to a temp log file so the terminal window can tail it
  const logFile = path.join(PROJECT_ROOT, `_pw_log_${run.id}.txt`);
  const logStream = fs.createWriteStream(logFile, { flags: 'w' });
  pw.stdout.pipe(logStream);
  pw.stderr.pipe(logStream);

  // Open terminal window that tails the log file
  spawnTerminalWindow(label, buildTailCommand(logFile, run.id));

  pw.on('close', (code) => {
    logStream.end();
    run.status   = (code === 0) ? 'done' : 'failed';
    run.exitCode = code;
    run.endTime  = Date.now();
    console.log(`[run #${run.id}] ${label} → exit ${code} (${run.status})`);

    // Write sentinel so the terminal tail-window knows to stop
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
// Helper: build the tail command/script for the current OS
// Tails log file until sentinel appears, then shows summary
// ─────────────────────────────────────────
function buildTailCommand(logFile, runId) {
  return IS_MAC ? buildTailCommandMac(logFile) : buildTailCommandWindows(logFile);
}

// ── Windows: PowerShell tail script (unchanged behavior) ──
function buildTailCommandWindows(logFile) {
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

// ── macOS: bash tail script (runs inside a real Terminal.app window) ──
function buildTailCommandMac(logFile) {
  const logSh = logFile.replace(/"/g, '\\"');
  return [
    `#!/bin/bash`,
    `LOGFILE="${logSh}"`,
    `WAITED=0`,
    // Wait for log file to exist (up to 10s)
    `while [ ! -f "$LOGFILE" ] && [ $WAITED -lt 50 ]; do sleep 0.2; WAITED=$((WAITED+1)); done`,
    ``,
    `POS=0`,
    `EXITCODE=""`,
    `DONE=0`,
    `while [ $DONE -eq 0 ]; do`,
    `  if [ -f "$LOGFILE" ]; then`,
    `    CONTENT=$(cat "$LOGFILE")`,
    `    LEN=\${#CONTENT}`,
    `    if [ $LEN -gt $POS ]; then`,
    `      NEWTEXT="\${CONTENT:$POS}"`,
    `      printf '%s' "$NEWTEXT"`,
    `      POS=$LEN`,
    `    fi`,
    `    if echo "$CONTENT" | grep -qE 'PLAYWRIGHT_DONE_[0-9]+'; then`,
    `      EXITCODE=$(echo "$CONTENT" | grep -oE 'PLAYWRIGHT_DONE_[0-9]+' | tail -1 | grep -oE '[0-9]+$')`,
    `      DONE=1`,
    `    fi`,
    `  fi`,
    `  if [ $DONE -eq 0 ]; then sleep 0.3; fi`,
    `done`,
    ``,
    `echo ""`,
    `echo -e "\\033[90m---------------------------------\\033[0m"`,
    `if [ "$EXITCODE" = "0" ]; then`,
    `  echo -e "\\033[32m  PASSED\\033[0m\\033[97m  All tests passed.\\033[0m"`,
    `else`,
    `  echo -e "\\033[31m  FAILED\\033[0m\\033[97m  Tests finished with exit code $EXITCODE.\\033[0m"`,
    `fi`,
    `echo -e "\\033[90m---------------------------------\\033[0m"`,
    `echo -e "\\033[37mPress ENTER to close this window...\\033[0m"`,
    `read -r _`,
    ``,
    `rm -f "$LOGFILE"`,
  ].join('\n');
}

// ─────────────────────────────────────────
// Helper: open a new detached terminal window for the current OS
//  - Windows → PowerShell (-EncodedCommand, avoids quoting/policy issues)
//  - macOS   → Terminal.app (via osascript), running a temp bash script
// ─────────────────────────────────────────
function spawnTerminalWindow(title, psOrShCommands) {
  if (IS_MAC) {
    spawnMacTerminalWindow(title, psOrShCommands);
  } else {
    spawnWindowsPsWindow(title, psOrShCommands);
  }
}

function spawnWindowsPsWindow(title, psCommands) {
  const safeRoot = PROJECT_ROOT.replace(/\\/g, '/').replace(/'/g, "''");

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

function spawnMacTerminalWindow(title, shCommands) {
  // Write the bash tail-script to a temp file, make it executable, then
  // open a real Terminal.app window that runs it (and sets its tab title).
  const scriptPath = path.join(os.tmpdir(), `pw_tail_${Date.now()}_${Math.random().toString(36).slice(2)}.sh`);

  const fullScript = [
    `#!/bin/bash`,
    `printf '\\033]0;%s\\007' "${title.replace(/"/g, '\\"')}"`,
    `cd "${PROJECT_ROOT.replace(/"/g, '\\"')}"`,
    shCommands,
    `rm -f "${scriptPath.replace(/"/g, '\\"')}"`,
  ].join('\n');

  fs.writeFileSync(scriptPath, fullScript, { mode: 0o755 });

  // Escape for embedding inside an AppleScript double-quoted string
  const safePath = scriptPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const appleScript = `tell application "Terminal"
  activate
  do script "bash \\"${safePath}\\""
end tell`;

  const child = spawn('osascript', ['-e', appleScript], {
    cwd:   PROJECT_ROOT,
    detached: true,
    stdio: 'ignore',
  });
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
  console.log(`  ➜  Platform: ${IS_MAC ? 'macOS (Terminal.app)' : IS_WINDOWS ? 'Windows (PowerShell)' : process.platform + ' (unsupported terminal, falling back to PowerShell path)'}`);
  const cfg = findConfigFile();
  if (cfg) {
    console.log(`  ➜  Config file: ${cfg}`);
  } else {
    console.log(`  ⚠  No playwright.config.(ts|js|mjs|cts|mts) found in ${PROJECT_ROOT}`);
    console.log(`     Runs will be launched without --config; Playwright will try its own default resolution.`);
  }
  console.log('');
});