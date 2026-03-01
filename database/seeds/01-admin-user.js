/**
 * Seed script to create admin user
 * Run with: node database/seeds/01-admin-user.js
 */

const crypto = require('crypto');
const { Client } = require('pg');

// Load environment variables
require('dotenv').config({ path: './backend/.env' });

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function encryptCredential(plaintext) {
    const key = Buffer.from(process.env.VELO_CREDENTIALS_ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

async function createAdminUser() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'velo_custom',
        user: process.env.DB_USER || 'velo_admin',
        password: process.env.DB_PASSWORD,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Read admin credentials from env — NEVER hardcode defaults in production
        const veloUsername = process.env.VELO_ADMIN_USERNAME;
        const veloPassword = process.env.VELO_ADMIN_PASSWORD;

        if (!veloUsername || !veloPassword) {
            console.error('❌ Set VELO_ADMIN_USERNAME and VELO_ADMIN_PASSWORD environment variables');
            process.exit(1);
        }
        
        const encryptedUsername = encryptCredential(veloUsername);
        const encryptedPassword = encryptCredential(veloPassword);

        // Check if admin user already exists
        const checkResult = await client.query(
            'SELECT id FROM users WHERE username = $1',
            ['admin']
        );

        if (checkResult.rows.length > 0) {
            console.log('Admin user already exists, updating credentials...');
            
            await client.query(
                `UPDATE users SET
                    velo_username_encrypted = $1,
                    velo_username_iv = $2,
                    velo_username_auth_tag = $3,
                    velo_password_encrypted = $4,
                    velo_password_iv = $5,
                    velo_password_auth_tag = $6,
                    updated_at = NOW()
                WHERE username = $7`,
                [
                    Buffer.from(encryptedUsername.encrypted, 'hex'),
                    encryptedUsername.iv,
                    encryptedUsername.authTag,
                    Buffer.from(encryptedPassword.encrypted, 'hex'),
                    encryptedPassword.iv,
                    encryptedPassword.authTag,
                    'admin'
                ]
            );
            
            console.log('✅ Admin user credentials updated successfully');
        } else {
            console.log('Creating new admin user...');
            
            await client.query(
                `INSERT INTO users (
                    username, 
                    email,
                    velo_username_encrypted, 
                    velo_username_iv, 
                    velo_username_auth_tag,
                    velo_password_encrypted, 
                    velo_password_iv, 
                    velo_password_auth_tag,
                    roles,
                    is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    'admin',
                    'admin@velo.local',
                    Buffer.from(encryptedUsername.encrypted, 'hex'),
                    encryptedUsername.iv,
                    encryptedUsername.authTag,
                    Buffer.from(encryptedPassword.encrypted, 'hex'),
                    encryptedPassword.iv,
                    encryptedPassword.authTag,
                    ['admin', 'user'],
                    true
                ]
            );
            
            console.log('✅ Admin user created successfully');
        }

        console.log('\nAdmin User Details:');
        console.log('Username: admin');
        console.log('Velo Username: admin');
        console.log('Velo Password: admin');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

createAdminUser();
