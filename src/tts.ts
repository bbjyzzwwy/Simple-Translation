import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';

const YOUDAO_TTS_URL = 'https://openapi.youdao.com/ttsapi';

/**
 * Speak text aloud using Youdao TTS API.
 * https://ai.youdao.com/DOCSIRMA/html/tts/api/yyhc/index.html
 */
export function speakText(
    text: string,
    language: 'en' | 'zh',
    appId: string,
    appSecret: string,
    voice: string = 'youxiaomei'
): Promise<void> {
    return new Promise<void>((resolve) => {
        const q = text.trim();
        if (!q || !appId || !appSecret) {
            resolve();
            return;
        }

        const salt = crypto.randomUUID();
        const curtime = String(Math.floor(Date.now() / 1000));

        // Build input for sign: q > 20 → truncate with length.
        const input = q.length > 20
            ? q.substring(0, 10) + q.length + q.substring(q.length - 10)
            : q;

        const sign = crypto.createHash('sha256')
            .update(appId + input + salt + curtime + appSecret)
            .digest('hex');

        const params = new URLSearchParams();
        params.set('q', q);
        params.set('appKey', appId);
        params.set('salt', salt);
        params.set('sign', sign);
        params.set('signType', 'v3');
        params.set('curtime', curtime);
        params.set('voiceName', voice);
        params.set('format', 'mp3');

        const body = params.toString();

        const req = https.request(YOUDAO_TTS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            // Check content-type to distinguish audio vs error.
            const contentType = res.headers['content-type'] || '';
            if (contentType.includes('audio/')) {
                const tmpFile = path.join(os.tmpdir(), `simple-translation-tts-${Date.now()}.mp3`);
                const file = fs.createWriteStream(tmpFile);
                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const playCmd = `/usr/bin/ffmpeg -i '${tmpFile}' -f s16le -ar 44100 -ac 2 - 2>/dev/null | /usr/bin/pacat --format=s16le --rate=44100 --channels=2`;
                    exec(playCmd, () => {
                        tryCleanup(tmpFile);
                        resolve();
                    });
                });
                file.on('error', () => {
                    tryCleanup(tmpFile);
                    resolve();
                });
            } else {
                // Error response — read body for error code.
                let data = '';
                res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
                res.on('end', () => {
                    console.error('[Simple Translation] Youdao TTS error:', data);
                    resolve();
                });
            }
        });

        req.on('error', (err: Error) => {
            console.error('[Simple Translation] Youdao TTS network error:', err.message);
            resolve();
        });

        req.write(body);
        req.end();
    });
}

function tryCleanup(file: string): void {
    try { if (fs.existsSync(file)) { fs.unlinkSync(file); } } catch { /* ignore */ }
}
