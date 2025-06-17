const { createPool } = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const { logActivity } = require('./activityLog');
const archiver = require('archiver');
const os = require('os');

// Create a connection pool
const pool = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000 // 10 seconds
});

const createBackup = async (userId) => {
    console.log(`Starting backup creation for user ${userId}...`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sqlFilename = `backup-${timestamp}.sql`;
    const zipFilename = `backup-${timestamp}.zip`;
    const tempDir = os.tmpdir();
    const tempSqlPath = path.join(tempDir, sqlFilename);
    const tempZipPath = path.join(tempDir, zipFilename);
    console.log('Temporary SQL path:', tempSqlPath);

    const { DB_HOST, DB_USER, DB_NAME } = process.env;

    if (!DB_HOST || !DB_USER || !DB_NAME) {
        throw new Error('Database configuration missing: DB_HOST, DB_USER, or DB_NAME not set');
    }

    const dataDir = path.resolve(__dirname, '../../data');
    console.log('Resolved data directory:', dataDir);

    if (!fs.existsSync(dataDir)) {
        throw new Error(`Backup failed: Data directory ${dataDir} not found`);
    }

    let connection;
    try {
        connection = await pool.getConnection();

        console.log('Writing SQL file...');
        const stream = fs.createWriteStream(tempSqlPath);
        stream.write(`-- Backup for ${DB_NAME} created at ${new Date().toISOString()}\n`);
        stream.write(`-- Database: ${DB_NAME}\n\n`);
        stream.write(`SET FOREIGN_KEY_CHECKS=0;\n\n`);

        console.log('Fetching tables...');
        const [tables] = await connection.query("SHOW TABLES");
        const tableNames = tables.map(row => Object.values(row)[0]);
        console.log('Tables:', tableNames);

        for (const table of tableNames) {
            console.log(`Processing table: ${table}`);
            const [createTable] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
            stream.write(`-- Table structure for ${table}\n`);
            stream.write(`${createTable[0]['Create Table']};\n\n`);

            const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
            if (rows.length > 0) {
                stream.write(`-- Data for ${table}\n`);
                stream.write(`INSERT INTO \`${table}\` VALUES\n`);
                rows.forEach((row, index) => {
                    const values = Object.values(row).map(val => {
                        if (val === null || val === undefined) return 'NULL';
                        if (val instanceof Date) {
                            return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                        }
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                        return val;
                    }).join(', ');
                    stream.write(`(${values})${index < rows.length - 1 ? ',' : ';'}\n`);
                });
                stream.write('\n');
            }
        }

        stream.write(`SET FOREIGN_KEY_CHECKS=1;\n`);
        stream.end();

        console.log('Waiting for SQL file to finish writing...');
        await new Promise((resolve, reject) => {
            stream.on('finish', () => {
                console.log('SQL file write completed');
                resolve();
            });
            stream.on('error', (err) => {
                console.error('SQL file write error:', err);
                reject(err);
            });
        });

        console.log('Creating ZIP archive...');
        const archive = archiver('zip', { zlib: { level: 9 } });
        const output = fs.createWriteStream(tempZipPath);

        archive.pipe(output);

        archive.on('progress', (progress) => {
            console.log(`ZIP progress: ${progress.entries.processed} files, ${progress.fs.processedBytes} bytes`);
        });

        archive.on('error', (err) => {
            console.error('ZIP archive error:', err);
            throw err;
        });

        console.log('Adding SQL file to ZIP...');
        archive.file(tempSqlPath, { name: sqlFilename });

        console.log(`Adding files from ${dataDir} to ZIP...`);
        archive.directory(dataDir, 'data');

        console.log('Finalizing ZIP archive...');
        await new Promise((resolve, reject) => {
            output.on('close', () => {
                console.log('ZIP archive finalized');
                resolve();
            });
            archive.finalize();
        });

        console.log('Logging backup to database...');
        const [result] = await connection.execute(
            'INSERT INTO backups (backup_filename, created_by) VALUES (?,?)',
            [zipFilename, userId]
        );

        await logActivity(userId, `Created database backup: ${zipFilename}`);
        console.log('Backup logged in database:', zipFilename);

        return {
            success: true,
            filename: zipFilename,
            stream: fs.createReadStream(tempZipPath),
            backupId: result.insertId,
            timestamp: new Date().toISOString(),
            cleanup: () => {
                if (fs.existsSync(tempSqlPath)) {
                    fs.unlink(tempSqlPath, err => {
                        if (err) console.error(`Failed to delete temp SQL file ${tempSqlPath}:`, err);
                        else console.log('Temporary SQL file deleted:', tempSqlPath);
                    });
                }
                if (fs.existsSync(tempZipPath)) {
                    fs.unlink(tempZipPath, err => {
                        if (err) console.error(`Failed to delete temp ZIP file ${tempZipPath}:`, err);
                        else console.log('Temporary ZIP file deleted:', tempZipPath);
                    });
                }
            }
        };
    } catch (error) {
        if (fs.existsSync(tempSqlPath)) {
            fs.unlinkSync(tempSqlPath);
            console.log('Cleaned up temp file due to error:', tempSqlPath);
        }
        console.error('Backup creation error:', error.message, error.stack);
        throw new Error(`Backup failed: ${error.message}`);
    } finally {
        if (connection) {
            connection.release();
            console.log('Database connection released');
        }
    }
};

const getBackups = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(`
            SELECT b.backup_id, b.backup_filename, b.backup_date,
            u.user_id, CONCAT(u.first_name, ' ', u.last_name) as user_name
            FROM backups b
            LEFT JOIN users u ON b.created_by = u.user_id
            ORDER BY b.backup_date DESC
        `);
        return rows;
    } finally {
        if (connection) connection.release();
    }
};

const restoreBackup = async (backupId, userId) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [backups] = await connection.execute(
            'SELECT backup_filename FROM backups WHERE backup_id = ?',
            [backupId]
        );

        if (backups.length === 0) throw new Error('Backup not found');

        const filename = backups[0].backup_filename;
        const filePath = path.join(__dirname, '../../backups', filename);

        if (!fs.existsSync(filePath)) throw new Error('Backup file not found on server');

        const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, MYSQL_PATH } = process.env;
        const passwordArg = DB_PASSWORD ? `--password="${DB_PASSWORD}"` : '';
        const mysqlPath = MYSQL_PATH || 'mysql';
        const cmd = `"${mysqlPath}" -h ${DB_HOST} -u ${DB_USER} ${passwordArg} ${DB_NAME} < "${filePath}"`;

        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            exec(cmd, { shell: 'cmd.exe' }, async (error, stdout, stderr) => {
                if (error) return reject(error);
                if (stderr && !stderr.includes('Warning')) return reject(new Error(stderr));

                try {
                    await logActivity(userId, `Restored database from backup: ${filename}`);
                    resolve({
                        success: true,
                        message: 'Database restored successfully',
                        filename,
                        timestamp: new Date().toISOString()
                    });
                } catch (logError) {
                    reject(logError);
                }
            });
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    createBackup,
    getBackups,
    restoreBackup
};
