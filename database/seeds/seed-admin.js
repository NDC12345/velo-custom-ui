'use strict';
const crypto = require('crypto');
const { Client } = require('pg');

const ALGO = 'aes-256-gcm';
function enc(txt) {
  const key = Buffer.from(process.env.VELO_CREDENTIALS_ENCRYPTION_KEY, 'hex');
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let e = cipher.update(txt, 'utf8', 'hex');
  e += cipher.final('hex');
  return { enc: e, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}

(async () => {
  const db = new Client({
    host:     process.env.DB_HOST     || 'postgres',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'velo_custom',
    user:     process.env.DB_USER     || 'velo_admin',
    password: process.env.DB_PASSWORD,
  });
  await db.connect();
  console.log('Connected to database');

  const u = enc('admin');
  const p = enc('admin');

  const ex = await db.query('SELECT id FROM users WHERE username = $1', ['admin']);
  if (ex.rows.length > 0) {
    await db.query(
      `UPDATE users
         SET velo_username_encrypted = $1,
             velo_username_iv        = $2,
             velo_username_auth_tag  = $3,
             velo_password_encrypted = $4,
             velo_password_iv        = $5,
             velo_password_auth_tag  = $6,
             roles                   = $7,
             is_active               = true,
             is_locked               = false,
             failed_login_attempts   = 0,
             updated_at              = NOW()
       WHERE username = $8`,
      [Buffer.from(u.enc,'hex'), u.iv, u.tag,
       Buffer.from(p.enc,'hex'), p.iv, p.tag,
       ['administrator','user'], 'admin']
    );
    console.log('admin user updated with full permissions');
  } else {
    await db.query(
      `INSERT INTO users
         (username, email,
          velo_username_encrypted, velo_username_iv, velo_username_auth_tag,
          velo_password_encrypted, velo_password_iv, velo_password_auth_tag,
          roles, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
      ['admin', 'admin@velo.local',
       Buffer.from(u.enc,'hex'), u.iv, u.tag,
       Buffer.from(p.enc,'hex'), p.iv, p.tag,
       ['administrator','user']]
    );
    console.log('admin user created with full permissions');
  }

  await db.end();
  console.log('Done. Login: admin / admin');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
