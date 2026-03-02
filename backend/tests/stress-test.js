/**
 * VeLo Custom UI — Full-Stack Stress & Functional Test Script
 *
 * Usage:
 *   node tests/stress-test.js
 *   node tests/stress-test.js --url http://localhost:3000 --user admin --pass <password>
 *   node tests/stress-test.js --concurrency 10 --skip-velo
 *
 * Options:
 *   --url          Base URL (default: http://localhost:3000)
 *   --backend-url  Direct backend URL (default: http://localhost:5000)
 *   --user         Login username  (default: admin)
 *   --pass         Login password
 *   --concurrency  Concurrent requests per batch (default: 5)
 *   --skip-velo    Skip tests that require a live Velociraptor server
 *   --verbose      Print full response bodies on failure
 *   --json         Output results as JSON
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) { return args.includes(name); }
function opt(name, def) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : def;
}

const BASE_URL    = opt('--url', 'http://localhost:3000');
const BACKEND_URL = opt('--backend-url', 'http://localhost:5000');
const USERNAME    = opt('--user', 'admin');
const PASSWORD    = opt('--pass', '');
const CONCURRENCY = parseInt(opt('--concurrency', '5'), 10);
const SKIP_VELO   = flag('--skip-velo');
const VERBOSE     = flag('--verbose');
const JSON_OUTPUT = flag('--json');

// ─── Minimal HTTP client (no dependencies) ───────────────────────────────────
let cookies = {};

function parseCookies(setCookieHeaders) {
  if (!Array.isArray(setCookieHeaders)) setCookieHeaders = [setCookieHeaders].filter(Boolean);
  for (const h of setCookieHeaders) {
    const [pair] = h.split(';');
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    cookies[k] = v;
  }
}

function getCookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

function request(method, urlStr, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;
    const bodyStr = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      'Cookie': getCookieHeader(),
      ...extraHeaders,
    };
    // Inject CSRF token for mutating methods
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      const csrf = cookies['csrf_token'];
      if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
    }

    const opts = {
      hostname: u.hostname,
      port:     u.port || (isHttps ? 443 : 80),
      path:     u.pathname + u.search,
      method:   method.toUpperCase(),
      headers,
      rejectUnauthorized: false,
    };

    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        parseCookies(res.headers['set-cookie']);
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('TIMEOUT')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const get  = (url, h)         => request('GET',    url, null, h);
const post = (url, body, h)   => request('POST',   url, body, h);
const put  = (url, body, h)   => request('PUT',    url, body, h);
const del  = (url, h)         => request('DELETE', url, null, h);
const patch= (url, body, h)   => request('PATCH',  url, body, h);

// ─── Test harness ─────────────────────────────────────────────────────────────
const results = [];
let passed = 0, failed = 0, skipped = 0;

const RESET = '\x1b[0m', RED = '\x1b[31m', GREEN = '\x1b[32m',
      YELLOW= '\x1b[33m', CYAN= '\x1b[36m', BOLD = '\x1b[1m', DIM = '\x1b[2m';

function resultSymbol(status) {
  if (status === 'PASS')   return GREEN + '✓' + RESET;
  if (status === 'SKIP')   return YELLOW + '○' + RESET;
  return RED + '✗' + RESET;
}

async function runTest(label, fn, { skipIf = false, critical = false } = {}) {
  if (skipIf) {
    skipped++;
    results.push({ label, status: 'SKIP', reason: 'skipped by condition' });
    if (!JSON_OUTPUT) console.log(`  ${resultSymbol('SKIP')} ${DIM}${label}${RESET}`);
    return null;
  }
  const start = Date.now();
  try {
    const result = await fn();
    passed++;
    const ms = Date.now() - start;
    results.push({ label, status: 'PASS', ms, result });
    if (!JSON_OUTPUT) {
      const msStr = ms > 5000 ? RED + ms + 'ms' + RESET : DIM + ms + 'ms' + RESET;
      console.log(`  ${resultSymbol('PASS')} ${label} ${msStr}`);
    }
    return result;
  } catch (err) {
    failed++;
    const ms = Date.now() - start;
    results.push({ label, status: 'FAIL', ms, error: err.message });
    if (!JSON_OUTPUT) {
      console.log(`  ${resultSymbol('FAIL')} ${BOLD}${label}${RESET}  ${RED}${err.message}${RESET}`);
      if (VERBOSE && err.response) {
        console.log(`            ${DIM}${JSON.stringify(err.response).slice(0, 300)}${RESET}`);
      }
    }
    if (critical) throw err;   // Abort suite on critical failure
    return null;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertStatus(res, ...codes) {
  if (!codes.includes(res.status)) {
    const body = typeof res.data === 'string' ? res.data.slice(0, 200) : JSON.stringify(res.data).slice(0, 200);
    throw new Error(`HTTP ${res.status} (expected ${codes.join('|')}): ${body}`);
  }
}

// ─── Test runner with concurrency ─────────────────────────────────────────────
async function runBatch(tests) {
  for (let i = 0; i < tests.length; i += CONCURRENCY) {
    await Promise.all(tests.slice(i, i + CONCURRENCY).map(t => t()));
  }
}

// ─── Test suites ──────────────────────────────────────────────────────────────

async function suiteHealth() {
  console.log(`\n${CYAN}${BOLD}── Health Checks ─────────────────────────────────────────────${RESET}`);

  await runTest('Backend /health', async () => {
    const res = await get(`${BACKEND_URL}/health`);
    assertStatus(res, 200);
    assert(res.data.status, 'missing status field');
  }, { critical: true });

  await runTest('Frontend nginx', async () => {
    const res = await get(`${BASE_URL}/`);
    assertStatus(res, 200);
  });

  await runTest('API prefix reachable', async () => {
    const res = await get(`${BACKEND_URL}/health`);
    assertStatus(res, 200);
  });
}

async function suiteAuth() {
  console.log(`\n${CYAN}${BOLD}── Authentication ────────────────────────────────────────────${RESET}`);
  let accessToken;

  // Login
  const loginResult = await runTest('POST /api/auth/login', async () => {
    assert(PASSWORD, 'No --pass provided, skipping auth tests');
    const res = await post(`${BACKEND_URL}/api/auth/login`, {
      username: USERNAME,
      veloPassword: PASSWORD,
    });
    assertStatus(res, 200);
    assert(res.data.success || res.data.token || res.data.user, 'no user/token in login response');
    assert(cookies['access_token'] || cookies['refresh_token'] || res.data.token, 'no session cookie set');
    return res.data;
  }, { critical: false });

  if (!loginResult) {
    skipped += 8;
    console.log(`  ${YELLOW}  (Remaining auth tests skipped — login failed or no password)${RESET}`);
    return;
  }

  await runTest('GET /api/auth/me', async () => {
    const res = await get(`${BACKEND_URL}/api/auth/me`);
    assertStatus(res, 200);
    assert(res.data.user || res.data.username, 'no user in /me response');
  });

  await runTest('POST /api/auth/refresh', async () => {
    const res = await post(`${BACKEND_URL}/api/auth/refresh`, {});
    assertStatus(res, 200, 204);
  });

  await runTest('GET /api/user/profile', async () => {
    const res = await get(`${BACKEND_URL}/api/user/profile`);
    assertStatus(res, 200);
    assert(res.data.success || res.data.id || res.data.username, 'no profile data');
  });

  await runTest('GET /api/user/velo-connection', async () => {
    const res = await get(`${BACKEND_URL}/api/user/velo-connection`);
    assertStatus(res, 200);
  });
}

async function suiteVeloProxy() {
  if (SKIP_VELO) {
    console.log(`\n${YELLOW}${BOLD}── Velociraptor Proxy (SKIPPED — --skip-velo flag set) ────────${RESET}`);
    return;
  }
  console.log(`\n${CYAN}${BOLD}── Velociraptor Proxy ────────────────────────────────────────${RESET}`);

  const tests = [
    ['GET /api/health/velo', async () => {
      const res = await get(`${BACKEND_URL}/api/health/velo`);
      assertStatus(res, 200);
      // 'ok' = connected, 'degraded' = not connected but endpoint reachable
      assert(res.data.status, 'missing status');
    }],
    ['GET /api/clients (search)', async () => {
      const res = await get(`${BACKEND_URL}/api/clients?count=10`);
      assertStatus(res, 200);
    }],
    ['GET /api/hunts', async () => {
      const res = await get(`${BACKEND_URL}/api/hunts?count=5`);
      assertStatus(res, 200);
    }],
    ['GET /api/artifacts', async () => {
      const res = await get(`${BACKEND_URL}/api/artifacts`);
      assertStatus(res, 200);
    }],
    ['GET /api/users (Velo users)', async () => {
      const res = await get(`${BACKEND_URL}/api/users`);
      assertStatus(res, 200);
    }],
    ['GET /api/users/me/traits', async () => {
      const res = await get(`${BACKEND_URL}/api/users/me/traits`);
      assertStatus(res, 200);
    }],
    ['GET /api/users/me/favorites', async () => {
      const res = await get(`${BACKEND_URL}/api/users/me/favorites`);
      assertStatus(res, 200);
    }],
    ['GET /api/notebooks', async () => {
      const res = await get(`${BACKEND_URL}/api/notebooks`);
      assertStatus(res, 200);
    }],
    ['GET /api/tools', async () => {
      const res = await get(`${BACKEND_URL}/api/tools`);
      assertStatus(res, 200);
    }],
    ['GET /api/server/metrics', async () => {
      const res = await get(`${BACKEND_URL}/api/server/metrics`);
      assertStatus(res, 200);
    }],
    ['GET /api/server/metadata', async () => {
      const res = await get(`${BACKEND_URL}/api/server/metadata`);
      assertStatus(res, 200);
    }],
    ['GET /api/events/available', async () => {
      const res = await get(`${BACKEND_URL}/api/events/available`);
      assertStatus(res, 200);
    }],
    ['GET /api/completions', async () => {
      const res = await get(`${BACKEND_URL}/api/completions`);
      assertStatus(res, 200);
    }],
    ['GET /api/secrets', async () => {
      const res = await get(`${BACKEND_URL}/api/secrets`);
      assertStatus(res, 200, 403);  // 403 if not org_admin
    }],
    ['GET /api/table?artifact=Generic.Client.Info', async () => {
      const res = await get(`${BACKEND_URL}/api/table?artifact=Generic.Client.Info`);
      assertStatus(res, 200, 400);
    }],
  ];

  await runBatch(tests.map(([label, fn]) => () => runTest(label, fn)));
}

async function suiteUserManagement() {
  console.log(`\n${CYAN}${BOLD}── User Management ───────────────────────────────────────────${RESET}`);
  const testUsername = `stress_test_user_${Date.now()}`;

  let createdOk = false;

  await runTest('POST /api/users (create + local PG record)', async () => {
    const res = await post(`${BACKEND_URL}/api/users`, {
      name: testUsername,
      username: testUsername,
      password: 'Str0ngP@ss!',
      roles: ['reader'],
      add_new_user: true,
    });
    // 200 = created in Velo, 403 = no perms, 500 = Velo down
    assertStatus(res, 200, 201, 400);
    createdOk = res.status < 400;
  });

  await runTest('GET /api/users (list Velo users)', async () => {
    const res = await get(`${BACKEND_URL}/api/users`);
    assertStatus(res, 200);
  });

  await runTest('GET /api/users/global', async () => {
    const res = await get(`${BACKEND_URL}/api/users/global`);
    assertStatus(res, 200);
  });

  if (createdOk) {
    await runTest(`GET /api/users/${testUsername}`, async () => {
      const res = await get(`${BACKEND_URL}/api/users/${encodeURIComponent(testUsername)}`);
      assertStatus(res, 200, 404);
    });

    await runTest(`POST /api/users/${testUsername}/roles`, async () => {
      const res = await post(`${BACKEND_URL}/api/users/${encodeURIComponent(testUsername)}/roles`, {
        name: testUsername, org: '', roles: ['analyst'],
      });
      assertStatus(res, 200, 204);
    });

    await runTest(`DELETE /api/users/${testUsername}`, async () => {
      const res = await del(`${BACKEND_URL}/api/users/${encodeURIComponent(testUsername)}`);
      assertStatus(res, 200, 204, 404);
    });
  }
}

async function suiteGeo() {
  console.log(`\n${CYAN}${BOLD}── Geo / Map ─────────────────────────────────────────────────${RESET}`);

  await runTest('GET /api/geo/clients (snapshot)', async () => {
    const res = await get(`${BACKEND_URL}/api/geo/clients`);
    assertStatus(res, 200);
    assert(Array.isArray(res.data), 'geo/clients should return an array');
  });
}

async function suiteOrgs() {
  console.log(`\n${CYAN}${BOLD}── Organizations ─────────────────────────────────────────────${RESET}`);

  await runTest('GET /api/orgs', async () => {
    const res = await get(`${BACKEND_URL}/api/orgs`);
    assertStatus(res, 200);
  });
}

async function suiteAI() {
  console.log(`\n${CYAN}${BOLD}── AI Assistant ──────────────────────────────────────────────${RESET}`);

  await runTest('GET /api/ai/status', async () => {
    const res = await get(`${BACKEND_URL}/api/ai/status`);
    assertStatus(res, 200);
  });

  await runTest('GET /api/ai/providers', async () => {
    const res = await get(`${BACKEND_URL}/api/ai/providers`);
    assertStatus(res, 200);
  });

  await runTest('GET /api/ai/provider (config)', async () => {
    const res = await get(`${BACKEND_URL}/api/ai/provider`);
    assertStatus(res, 200, 404);
  });
}

async function suiteCases() {
  console.log(`\n${CYAN}${BOLD}── Case Management ───────────────────────────────────────────${RESET}`);

  await runTest('GET /api/cases', async () => {
    const res = await get(`${BACKEND_URL}/api/cases`);
    assertStatus(res, 200, 404);
  });

  await runTest('GET /api/alert-rules', async () => {
    const res = await get(`${BACKEND_URL}/api/alert-rules`);
    assertStatus(res, 200, 404);
  });

  await runTest('GET /api/saved-queries', async () => {
    const res = await get(`${BACKEND_URL}/api/saved-queries`);
    assertStatus(res, 200, 404);
  });

  await runTest('GET /api/mitre', async () => {
    const res = await get(`${BACKEND_URL}/api/mitre`);
    assertStatus(res, 200, 404);
  });

  await runTest('GET /api/tags', async () => {
    const res = await get(`${BACKEND_URL}/api/tags`);
    assertStatus(res, 200, 404);
  });
}

async function suiteSettings() {
  console.log(`\n${CYAN}${BOLD}── Settings & Session ────────────────────────────────────────${RESET}`);

  await runTest('GET /api/user/velo-connection (load saved settings)', async () => {
    const res = await get(`${BACKEND_URL}/api/user/velo-connection`);
    assertStatus(res, 200);
  });

  await runTest('GET /api/health/velo (Settings page testConnection)', async () => {
    const res = await get(`${BACKEND_URL}/api/health/velo`);
    assertStatus(res, 200);
    assert(['ok', 'degraded'].includes(res.data.status), `unexpected status: ${res.data.status}`);
  });

  await runTest('SSE endpoint connects', async () => {
    // Just check that the endpoint is reachable (not testing full SSE stream)
    const res = await get(`${BACKEND_URL}/api/sse`);
    // SSE returns 200 with text/event-stream; a quick GET may return 200 before streaming
    assert(res.status < 500, `SSE endpoint returned ${res.status}`);
  });
}

async function suiteConcurrencyStress() {
  console.log(`\n${CYAN}${BOLD}── Concurrency Stress (${CONCURRENCY} parallel req each) ──────────────────${RESET}`);

  // Hammer safe read endpoints in parallel
  const safeEndpoints = [
    `${BACKEND_URL}/api/health/velo`,
    `${BACKEND_URL}/api/ai/status`,
    `${BACKEND_URL}/api/user/profile`,
    `${BACKEND_URL}/api/geo/clients`,
  ].filter(Boolean);

  await runTest(`${CONCURRENCY}x parallel GET /api/health/velo`, async () => {
    const urls = Array(CONCURRENCY).fill(`${BACKEND_URL}/api/health/velo`);
    const results = await Promise.allSettled(urls.map(u => get(u)));
    const fails = results.filter(r => r.status === 'rejected' || (r.value && r.value.status >= 500));
    if (fails.length > 0) throw new Error(`${fails.length} of ${CONCURRENCY} requests failed`);
  });

  await runTest(`${CONCURRENCY}x parallel GET /api/geo/clients`, async () => {
    const urls = Array(CONCURRENCY).fill(`${BACKEND_URL}/api/geo/clients`);
    const results = await Promise.allSettled(urls.map(u => get(u)));
    const fails = results.filter(r => r.status === 'rejected' || (r.value && r.value.status >= 500));
    if (fails.length > 0) throw new Error(`${fails.length} of ${CONCURRENCY} requests failed`);
  });

  await runTest(`${CONCURRENCY}x parallel GET /api/auth/me`, async () => {
    const urls = Array(CONCURRENCY).fill(`${BACKEND_URL}/api/auth/me`);
    const results = await Promise.allSettled(urls.map(u => get(u)));
    const fails = results.filter(r => r.status === 'rejected' || (r.value && r.value.status >= 500));
    if (fails.length > 0) throw new Error(`${fails.length} of ${CONCURRENCY} requests failed`);
  });
}

async function suiteLogout() {
  console.log(`\n${CYAN}${BOLD}── Session Cleanup ───────────────────────────────────────────${RESET}`);

  await runTest('POST /api/auth/logout', async () => {
    const res = await post(`${BACKEND_URL}/api/auth/logout`, {});
    assertStatus(res, 200, 204);
    // Cookies should be cleared
  });

  await runTest('GET /api/auth/me returns 401 after logout', async () => {
    const res = await get(`${BACKEND_URL}/api/auth/me`);
    assertStatus(res, 401);
  });
}

// ─── Report ───────────────────────────────────────────────────────────────────
function printReport() {
  const total = passed + failed + skipped;
  const duration = results.reduce((s, r) => s + (r.ms || 0), 0);

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ passed, failed, skipped, total, duration_ms: duration, results }, null, 2));
    return;
  }

  console.log(`\n${'─'.repeat(64)}`);
  console.log(`${BOLD}Results: ${GREEN}${passed} passed${RESET}  ${failed ? RED : ''}${failed} failed${RESET}  ${YELLOW}${skipped} skipped${RESET}  / ${total} total  (${duration}ms)`);

  if (failed > 0) {
    console.log(`\n${RED}${BOLD}Failed tests:${RESET}`);
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ${RED}✗ ${r.label}${RESET}`);
      console.log(`    ${DIM}${r.error}${RESET}`);
    });
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!JSON_OUTPUT) {
    console.log(`\n${BOLD}VeLo Stress Test${RESET}  ${DIM}${new Date().toISOString()}${RESET}`);
    console.log(`${DIM}Base:    ${BASE_URL}${RESET}`);
    console.log(`${DIM}Backend: ${BACKEND_URL}${RESET}`);
    console.log(`${DIM}User:    ${USERNAME}${RESET}`);
    console.log(`${DIM}Conc.:   ${CONCURRENCY}${RESET}`);
    if (SKIP_VELO) console.log(`${YELLOW}Velociraptor proxy tests skipped (--skip-velo)${RESET}`);
    if (!PASSWORD) console.log(`${YELLOW}No --pass provided; auth-dependent tests will be skipped${RESET}`);
  }

  try {
    await suiteHealth();
    await suiteAuth();
    if (PASSWORD) {
      // These suites require a valid session
      await suiteSettings();
      await suiteGeo();
      await suiteOrgs();
      await suiteAI();
      await suiteCases();
      await suiteVeloProxy();
      await suiteUserManagement();
      await suiteConcurrencyStress();
      await suiteLogout();
    }
  } catch (critErr) {
    if (!JSON_OUTPUT) console.error(`\n${RED}${BOLD}Critical failure — aborting:${RESET} ${critErr.message}`);
    failed++;
  }

  printReport();
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(2);
});
