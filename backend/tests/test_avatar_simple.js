'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');
const DB = { host: process.env.DB_HOST||'postgres', port: parseInt(process.env.DB_PORT)||5432, database: process.env.DB_NAME||'velo_custom', user: process.env.DB_USER||'velo_admin', password: process.env.DB_PASSWORD||'' };
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const DATA_URI = `data:image/png;base64,${TINY_PNG_B64}`;
const TEST_USER = `_avtest_${Date.now()}`;
const TEST_PASS  = 'Avatar@Test1!';
let cookies = '', csrfToken = '', testUserId = null;
function request(method, urlPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const ct = extraHeaders['Content-Type'] || 'application/json';
    const bodyBuf = Buffer.isBuffer(body) ? body : body ? Buffer.from(JSON.stringify(body)) : null;
    const opts = { hostname: '127.0.0.1', port: 5000, path: urlPath, method, headers: { 'Content-Type': ct, Cookie: cookies, ...(csrfToken?{'X-CSRF-Token':csrfToken}:{}), ...(bodyBuf?{'Content-Length':bodyBuf.length}:{}), ...extraHeaders } };
    const req = http.request(opts, (res) => {
      (res.headers['set-cookie']||[]).forEach(c => { const[pair]=c.split(';'); const eq=pair.indexOf('='); const n=pair.slice(0,eq).trim(); const v=pair.slice(eq+1).trim(); cookies=cookies.split(';').filter(s=>!s.trim().startsWith(n+'=')).concat(n+'='+v).join('; '); if(n==='csrf_token')csrfToken=v; });
      let data = ''; res.on('data', c=>(data+=c)); res.on('end', ()=>{ try{resolve({status:res.statusCode,body:JSON.parse(data)})}catch{resolve({status:res.statusCode,body:data})} });
    });
    req.on('error', reject); if(bodyBuf)req.write(bodyBuf); req.end();
  });
}
function assert(cond, msg){ if(!cond)throw new Error('FAIL: '+msg); console.log('  check '+msg); }
(async()=>{
  const db=new Client(DB); await db.connect();
  try {
    console.log('\n-- 0. Register'); const reg=await request('POST','/api/auth/register',{username:TEST_USER,password:TEST_PASS,email:TEST_USER+'@test.com',veloServerUrl:''});
    assert(reg.status===201,'Register 201 got '+reg.status+' '+JSON.stringify(reg.body)); testUserId=reg.body.user?.id; assert(testUserId,'got id'); assert(csrfToken,'csrf after register');
    console.log('\n-- 1. Login'); const login=await request('POST','/api/auth/login',{username:TEST_USER,password:TEST_PASS});
    assert(login.status===200,'Login 200 got '+login.status); assert(csrfToken,'csrf after login');
    console.log('\n-- 2. Base64 upload'); const b1=await request('POST','/api/user/avatar/base64',{avatarBase64:DATA_URI});
    assert(b1.status===200,'b64 upload 200 got '+b1.status+JSON.stringify(b1.body)); assert(b1.body.success,'success'); const ap1=b1.body.data?.avatarUrl;
    assert(ap1&&ap1.startsWith('/uploads/avatars/'),'file path'); const d1=path.join('/app',ap1); assert(fs.existsSync(d1),'file on disk'); assert(fs.statSync(d1).size>0,'has content');
    const r1=await db.query('SELECT avatar_url FROM users WHERE id=$1',[testUserId]); assert(r1.rows[0].avatar_url===ap1,'db matches');
    console.log('\n-- 3. Profile'); const prof=await request('GET','/api/user/profile');
    assert(prof.status===200,'prof 200'); assert(prof.body.data?.avatar_url===ap1,'profile path');
    console.log('\n-- 4. Replace'); const b2=await request('POST','/api/user/avatar/base64',{avatarBase64:DATA_URI});
    assert(b2.status===200,'replace 200'); const ap2=b2.body.data?.avatarUrl; assert(ap2!==ap1,'new path'); assert(!fs.existsSync(d1),'old deleted'); assert(fs.existsSync(path.join('/app',ap2)),'new exists');
    console.log('\n-- 5. Delete'); const del=await request('DELETE','/api/user/avatar');
    assert(del.status===200,'delete 200'); assert(!fs.existsSync(path.join('/app',ap2)),'disk removed'); const r2=await db.query('SELECT avatar_url FROM users WHERE id=$1',[testUserId]); assert(r2.rows[0].avatar_url===null,'db null');
    console.log('\n-- 6. Multipart'); const bnd=`B${Date.now()}`; const img=Buffer.from(TINY_PNG_B64,'base64'); const mpb=Buffer.concat([Buffer.from(`--${bnd}\r\nContent-Disposition: form-data; name="avatar"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`),img,Buffer.from(`\r\n--${bnd}--\r\n`)]);
    const mp=await request('POST','/api/user/avatar',mpb,{'Content-Type':`multipart/form-data; boundary=${bnd}`,'Content-Length':String(mpb.length)});
    assert(mp.status===200,'mp 200 got '+mp.status+JSON.stringify(mp.body)); assert(mp.body.success,'mp success'); const mpPath=mp.body.data?.avatarUrl; assert(mpPath&&mpPath.startsWith('/uploads/avatars/'),'mp path'); assert(fs.existsSync(path.join('/app',mpPath)),'mp on disk');
    console.log('\n ALL 6 TESTS PASSED\n');
  } catch(err){ console.error('\n TEST FAILED:',err.message); process.exitCode=1; }
  finally {
    if(testUserId){ const lr=await db.query('SELECT avatar_url FROM users WHERE id=$1',[testUserId]).catch(()=>({rows:[]})); const lf=lr.rows[0]?.avatar_url; if(lf&&lf.startsWith('/uploads/avatars/')){const fp=path.join('/app',lf); if(fs.existsSync(fp))fs.unlinkSync(fp);} await db.query('DELETE FROM revoked_tokens WHERE user_id=$1',[testUserId]).catch(()=>{}); await db.query('DELETE FROM users WHERE id=$1',[testUserId]).catch(()=>{}); console.log('Cleaned up user'); }
    await db.end();
  }
})();

