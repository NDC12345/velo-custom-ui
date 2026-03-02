/**
 * Avatar Upload E2E Test
 * Run from /app folder inside backend container:
 *   node test-avatar.js
 *
 * Tests:
 *  1. Register a disposable test user via /api/auth/register
 *  2. Login to get session cookies + CSRF token
 *  3. Upload avatar via base64 endpoint → file saved to disk, path in DB
 *  4. Re-upload replaces old file
 *  5. Profile GET returns correct avatar_url
 *  6. Delete avatar → file removed, DB NULL
 *  7. Upload via multipart form-data → file saved
 */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB = {
  host:     process.env.DB_HOST     || 'postgres',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'velo_custom',
  user:     process.env.DB_USER     || 'velo_admin',
  password: process.env.DB_PASSWORD || '',
};

// 1×1 transparent PNG (68 bytes decoded)
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const DATA_URI     = `data:image/png;base64,${TINY_PNG_B64}`;

const TEST_USER = `_avtest_${Date.now()}`;
const TEST_PASS  = 'Avatar@Test1!';

let cookies    = '';
let csrfToken  = '';
let testUserId = null;

// ── HTTP helper ──────────────────────────────────────────────────────────────
function request(method, urlPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const json = (body && typeof body === 'string') ? body : (body ? JSON.stringify(body) : null);
    const contentType = extraHeaders['Content-Type'] || 'application/json';
    const opts = {
      hostname: '127.0.0.1',
      port:     5000,
      path:     urlPath,
      method,
      headers: {
        'Content-Type': contentType,
        Cookie: cookies,
        ...(csrfToken           ? { 'X-CSRF-Token': csrfToken }                 : {}),
        ...(json                ? { 'Content-Length': Buffer.byteLength(json) } : {}),
        ...extraHeaders,
      },
    };
    const req = http.request(opts, (res) => {
      const sc = res.headers['set-cookie'] || [];
      for (const c of sc) {
        const [pair] = c.split(';');
        const [name, val] = pair.split('=');
        cookies = cookies.split(';')
          .filter(s => !s.trim().startsWith(`${name.trim()}=`))
          .concat(`${name.trim()}=${val ? val.trim() : ''}`)
          .join('; ');
        if (name.trim() === 'csrf_token') csrfToken = val ? val.trim() : '';
      }
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (json) req.write(json);
    req.end();
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const db = new Client(DB);
  await db.connect();

  try {
    // ── 0. Register test user ───────────────────────────────────────────────
    console.log('\n── 0. Register test user ──────────────────────────────────');
    const reg = await request('POST', '/api/auth/register', {
      username:     TEST_USER,
      password:     TEST_PASS,
      email:        `${TEST_USER}@test.invalid`,
      veloServerUrl:'',
    });
    assert(reg.status === 201, `Register status 201 (got ${reg.status}): ${JSON.stringify(reg.body)}`);
    testUserId = reg.body.user?.id;
    assert(testUserId, `Got user id: ${testUserId}`);
    // After register we have httponly cookie + csrf
    assert(csrfToken, `CSRF token from register: ${csrfToken}`);

    // ── 1. Re-login for clean session ───────────────────────────────────────
    console.log('\n── 1. Login ───────────────────────────────────────────────');
    const login = await request('POST', '/api/auth/login', {
      username: TEST_USER,
      password: TEST_PASS,
    });
    assert(login.status === 200, `Login status 200 (got ${login.status})`);
    assert(csrfToken, `CSRF token after login: ${csrfToken}`);

    // ── 2. Base64 upload ────────────────────────────────────────────────────
    console.log('\n── 2. Base64 avatar upload ────────────────────────────────');
    const b64u = await request('POST', '/api/user/avatar/base64', { avatarBase64: DATA_URI });
    assert(b64u.status === 200, `Status 200 (got ${b64u.status}): ${JSON.stringify(b64u.body)}`);
    assert(b64u.body.success === true, 'success=true');
    const avatarPath1 = b64u.body.data?.avatarUrl;
    assert(avatarPath1 && avatarPath1.startsWith('/uploads/avatars/'), `avatarUrl is file path: ${avatarPath1}`);
    const disk1 = path.join('/app', avatarPath1);
    assert(fs.existsSync(disk1), `File on disk: ${disk1}`);
    assert(fs.statSync(disk1).size > 0, `File has content`);

    // Verify DB
    const r1 = await db.query('SELECT avatar_url FROM users WHERE id = $1', [testUserId]);
    assert(r1.rows[0].avatar_url === avatarPath1, `DB path matches: ${r1.rows[0].avatar_url}`);

    // ── 3. Profile returns correct path ─────────────────────────────────────
    console.log('\n── 3. Profile endpoint ────────────────────────────────────');
    const prof = await request('GET', '/api/user/profile');
    assert(prof.status === 200, `Profile 200 (got ${prof.status})`);
    assert(prof.body.data?.avatar_url === avatarPath1, `Profile avatar_url matches: ${prof.body.data?.avatar_url}`);

    // ── 4. Replace avatar (old file must be deleted) ─────────────────────────
    console.log('\n── 4. Replace avatar ──────────────────────────────────────');
    const b64u2 = await request('POST', '/api/user/avatar/base64', { avatarBase64: DATA_URI });
    assert(b64u2.status === 200, `Replacement upload 200 (got ${b64u2.status})`);
    const avatarPath2 = b64u2.body.data?.avatarUrl;
    assert(avatarPath2 !== avatarPath1, 'New path differs from old');
    assert(!fs.existsSync(disk1), `Old file deleted from disk`);
    assert(fs.existsSync(path.join('/app', avatarPath2)), `New file on disk`);

    // ── 5. Delete avatar ─────────────────────────────────────────────────────
    console.log('\n── 5. Delete avatar ───────────────────────────────────────');
    const del = await request('DELETE', '/api/user/avatar');
    assert(del.status === 200, `Delete 200 (got ${del.status})`);
    assert(!fs.existsSync(path.join('/app', avatarPath2)), `File removed after delete`);
    const r2 = await db.query('SELECT avatar_url FROM users WHERE id = $1', [testUserId]);
    assert(r2.rows[0].avatar_url === null, `DB avatar_url NULL after delete`);

    // ── 6. Multipart upload ──────────────────────────────────────────────────
    console.log('\n── 6. Multipart form-data upload ──────────────────────────');
    const boundary = `FormBound${Date.now()}`;
    const imgBuf   = Buffer.from(TINY_PNG_B64, 'base64');
    const header   = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`);
    const footer   = Buffer.from(`\r\n--${boundary}--\r\n`);
    const mpBody   = Buffer.concat([header, imgBuf, footer]);

    const mpResult = await new Promise((resolve, reject) => {
      const opts = {
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/user/avatar',
        method: 'POST',
        headers: {
          'Content-Type':   `multipart/form-data; boundary=${boundary}`,
          'Content-Length': mpBody.length,
          Cookie:           cookies,
          'X-CSRF-Token':   csrfToken,
        },
      };
      const req = http.request(opts, (res) => {
        let d = '';
        res.on('data', c => (d += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, body: d }); }
        });
      });
      req.on('error', reject);
      req.write(mpBody);
      req.end();
    });
    assert(mpResult.status === 200, `Multipart 200 (got ${mpResult.status}): ${JSON.stringify(mpResult.body)}`);
    assert(mpResult.body.success === true, 'Multipart success=true');
    const mpPath = mpResult.body.data?.avatarUrl;
    assert(mpPath && mpPath.startsWith('/uploads/avatars/'), `Multipart avatarUrl is path: ${mpPath}`);
    assert(fs.existsSync(path.join('/app', mpPath)), `Multipart file on disk`);

    console.log('\n✅  ALL 6 TESTS PASSED\n');

  } catch (err) {
    console.error('\n❌  TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    if (testUserId) {
      // Remove leftover file
      const lr = await db.query('SELECT avatar_url FROM users WHERE id = $1', [testUserId]).catch(() => ({ rows: [] }));
      const lf = lr.rows[0]?.avatar_url;
      if (lf && lf.startsWith('/uploads/avatars/')) {
        const fp = path.join('/app', lf);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      // Remove test user (hard delete)
      await db.query('DELETE FROM revoked_tokens WHERE user_id = $1', [testUserId]).catch(() => {});
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => {});
      console.log(`  Cleaned up test user "${TEST_USER}"`);
    }
    await db.end();
  }
})();

const { Client } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// ── Config ──────────────────────────────────────────────────────────────────
const BASE = 'http://127.0.0.1:5000';
const DB = {
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'velo_custom',
  user: process.env.DB_USER || 'velo_admin',
  password: process.env.DB_PASSWORD || '',
};

// 1x1 red pixel PNG (base64)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';
const DATA_URI = `data:image/png;base64,${TINY_PNG_BASE64}`;

let cookies = '';
let csrfToken = '';
let testUserId = null;
const TEST_USER = `_avatar_test_${Date.now()}`;
const TEST_PASS  = 'Test@12345!';

// ── Helpers ──────────────────────────────────────────────────────────────────
function request(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const json = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies,
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...(json ? { 'Content-Length': Buffer.byteLength(json) } : {}),
        ...extraHeaders,
      },
    };
    const req = http.request(opts, (res) => {
      // Persist cookies
      const setCookies = res.headers['set-cookie'] || [];
      for (const c of setCookies) {
        const [pair] = c.split(';');
        const [name, val] = pair.split('=');
        // Remove existing cookie with same name and append
        cookies = cookies.split(';')
          .filter(s => !s.trim().startsWith(`${name.trim()}=`))
          .concat(`${name.trim()}=${val.trim()}`)
          .join('; ');
        if (name.trim() === 'csrf_token') csrfToken = val.trim();
      }
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.status || res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (json) req.write(json);
    req.end();
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const db = new Client(DB);
  await db.connect();

  try {
    // ── Setup: create disposable test user ──────────────────────────────────
    console.log('\n── Setup ──────────────────────────────────────────────────');
    const hash = await bcrypt.hash(TEST_PASS, 10);
    const ins = await db.query(
      `INSERT INTO users (username, password_hash, email, is_active, roles)
       VALUES ($1, $2, $3, true, ARRAY['admin'])
       RETURNING id`,
      [TEST_USER, hash, `${TEST_USER}@test.invalid`]
    );
    testUserId = ins.rows[0].id;
    console.log(`  ✓ Created test user "${TEST_USER}" (${testUserId})`);

    // ── 1. Login ────────────────────────────────────────────────────────────
    console.log('\n── 1. Login ────────────────────────────────────────────────');
    const login = await request('POST', '/api/auth/login', {
      username: TEST_USER,
      password: TEST_PASS,
    });
    assert(login.status === 200, `Login succeeded (status ${login.status})`);
    // csrfToken should have been set from cookies
    assert(csrfToken, 'CSRF token received');

    // ── 2. Base64 avatar upload ─────────────────────────────────────────────
    console.log('\n── 2. Base64 avatar upload ─────────────────────────────────');
    const b64Upload = await request('POST', '/api/user/avatar/base64', {
      avatarBase64: DATA_URI,
    });
    assert(b64Upload.status === 200, `Status 200 (got ${b64Upload.status}): ${JSON.stringify(b64Upload.body)}`);
    assert(b64Upload.body.success, 'Response success=true');
    const avatarPath = b64Upload.body.data?.avatarUrl;
    assert(avatarPath && avatarPath.startsWith('/uploads/avatars/'), `avatarUrl is a file path: ${avatarPath}`);

    // Verify file actually exists on disk
    const diskPath = path.join('/app', avatarPath);
    assert(fs.existsSync(diskPath), `File exists on disk: ${diskPath}`);
    const stat = fs.statSync(diskPath);
    assert(stat.size > 0, `File has content (${stat.size} bytes)`);
    console.log(`  ✓ File on disk: ${diskPath} (${stat.size} bytes)`);

    // Verify DB was updated
    const dbRow = await db.query('SELECT avatar_url FROM users WHERE id = $1', [testUserId]);
    assert(dbRow.rows[0].avatar_url === avatarPath, `DB avatar_url matches: ${dbRow.rows[0].avatar_url}`);

    // ── 3. Profile endpoint returns correct avatar_url ─────────────────────
    console.log('\n── 3. Profile endpoint ─────────────────────────────────────');
    const profile = await request('GET', '/api/user/profile');
    assert(profile.status === 200, `Profile status 200 (got ${profile.status})`);
    assert(profile.body.data?.avatar_url === avatarPath, `Profile returns correct avatar_url: ${profile.body.data?.avatar_url}`);

    // ── 4. Second upload replaces old file ─────────────────────────────────
    console.log('\n── 4. Replace existing avatar ──────────────────────────────');
    const firstFile = diskPath;
    const b64Upload2 = await request('POST', '/api/user/avatar/base64', { avatarBase64: DATA_URI });
    assert(b64Upload2.status === 200, `Replacement upload status 200 (got ${b64Upload2.status})`);
    const newPath = b64Upload2.body.data?.avatarUrl;
    assert(newPath !== avatarPath, 'New filename is different from old');
    assert(!fs.existsSync(firstFile), `Old file deleted: ${firstFile}`);
    const newDiskPath = path.join('/app', newPath);
    assert(fs.existsSync(newDiskPath), `New file exists: ${newDiskPath}`);

    // ── 5. Delete avatar ────────────────────────────────────────────────────
    console.log('\n── 5. Delete avatar ────────────────────────────────────────');
    const del = await request('DELETE', '/api/user/avatar');
    assert(del.status === 200, `Delete status 200 (got ${del.status})`);
    assert(!fs.existsSync(newDiskPath), `File removed from disk after delete`);
    const dbAfterDel = await db.query('SELECT avatar_url FROM users WHERE id = $1', [testUserId]);
    assert(dbAfterDel.rows[0].avatar_url === null, 'avatar_url is NULL in DB after delete');

    // ── 6. Multipart upload ─────────────────────────────────────────────────
    console.log('\n── 6. Multipart form-data upload ───────────────────────────');
    // Encode tiny PNG as a simple multipart body
    const boundary = `----FormBoundary${Date.now()}`;
    const imgBuf   = Buffer.from(TINY_PNG_BASE64, 'base64');
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`,
      imgBuf,
      `\r\n--${boundary}--\r\n`,
    ];
    const multipartBody = Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));

    await new Promise((resolve, reject) => {
      const opts = {
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/user/avatar',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': multipartBody.length,
          Cookie: cookies,
          'X-CSRF-Token': csrfToken,
        },
      };
      const req = http.request(opts, (res) => {
        let d = '';
        res.on('data', c => (d += c));
        res.on('end', () => {
          try {
            const body = JSON.parse(d);
            assert(res.statusCode === 200, `Multipart upload status 200 (got ${res.statusCode}): ${d}`);
            assert(body.success, 'Multipart response success=true');
            const mp = body.data?.avatarUrl;
            assert(mp && mp.startsWith('/uploads/avatars/'), `Multipart avatarUrl is file path: ${mp}`);
            assert(fs.existsSync(path.join('/app', mp)), `Multipart file on disk: ${mp}`);
            // Clean up multipart file
            fs.unlinkSync(path.join('/app', mp));
          } catch(e) { return reject(e); }
          resolve();
        });
      });
      req.on('error', reject);
      req.write(multipartBody);
      req.end();
    });

    console.log('\n✅ ALL TESTS PASSED\n');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    // Cleanup: remove test user + any leftover files
    if (testUserId) {
      const remaining = await db.query('SELECT avatar_url FROM users WHERE id = $1', [testUserId]);
      const leftover = remaining.rows[0]?.avatar_url;
      if (leftover && leftover.startsWith('/uploads/avatars/')) {
        const f = path.join('/app', leftover);
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
      console.log(`  Cleaned up test user "${TEST_USER}"`);
    }
    await db.end();
  }
})();
