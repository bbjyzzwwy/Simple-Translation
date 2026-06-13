import * as https from 'https';
import { LanguageCode, TranslationApiResponse, AppSettings } from './types';
import { detectLanguage } from './config';

/**
 * Translate text, auto-selecting DeepSeek API (if configured) or MyMemory fallback.
 * For single words, uses a dictionary-style prompt for multiple meanings.
 */
export async function translate(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    settings: AppSettings
): Promise<string | null> {
    const sourceLang: string = from === 'auto' ? detectLanguage(text) : from;
    const targetLang: string = to;

    if (sourceLang === targetLang) {
        return text;
    }

    if (settings.deepseekApiKey) {
        // CJK: single-word if ≤ 4 characters (no spaces in Chinese).
        // Non-CJK: single-word if no spaces and ≤ 50 chars.
        const isCJK = /^[一-鿿]{1,4}$/.test(text) || /^[^一-鿿]{1,50}$/.test(text) && !text.includes(' ');
        const isSingleWord = text.length <= 4 ? isCJK : (!text.includes(' ') && text.length <= 50);
        const result = await deepseekTranslate(text, sourceLang, targetLang, settings.deepseekApiKey, settings.deepseekModel, isSingleWord);
        if (result !== null) {
            return result;
        }
        console.error('[Simple Translation] DeepSeek failed, falling back to MyMemory.');
    }

    return mymemoryTranslate(text, sourceLang, targetLang, settings.apiEndpoint);
}

/** Language name mapping for prompt. */
const LANG_NAME: Record<string, string> = { zh: 'Chinese', en: 'English' };

/**
 * Translate using DeepSeek API (OpenAI-compatible chat completions).
 * For single words, uses a dictionary prompt with multiple meanings.
 */
function deepseekTranslate(
    text: string,
    from: string,
    to: string,
    apiKey: string,
    model: string,
    isSingleWord: boolean = false
): Promise<string | null> {
    const fromName = LANG_NAME[from] || from;
    const toName = LANG_NAME[to] || to;

    let systemPrompt: string;
    if (isSingleWord) {
        if (from === 'zh' && to === 'en') {
            // Chinese→English dictionary: show multiple English translations.
            systemPrompt = `You are a Chinese-English dictionary. List the English translations for the Chinese word "${text}".
Include parts of speech (n., v., adj., adv., etc.) and multiple common translations.
Format exactly like this example:
n. train; railway; rail
v. train; drill; practice
Only include parts of speech that actually apply. Be concise. Output ONLY the definition lines, nothing else.`;
        } else {
            // English→Chinese or other: show Chinese definitions.
            systemPrompt = `You are a dictionary. Provide the Chinese definition of the word "${text}".
Include parts of speech (n., v., adj., adv., prep., etc.) and multiple common meanings.
Format exactly like this example:
n. 含义1；含义2；含义3
v. 含义1；含义2
Only include parts of speech that actually apply. Be concise. Output ONLY the definition lines, nothing else.`;
        }
    } else {
        systemPrompt = `You are a professional translator. Translate the following text from ${fromName} to ${toName}. Only respond with the translation, no explanations, no extra text.`;
    }

    const body = JSON.stringify({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
        ],
        max_tokens: 1024,
        temperature: 0.1,
    });

    const options = {
        hostname: 'api.deepseek.com',
        port: 443,
        path: '/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(body),
        },
    };

    return new Promise<string | null>((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk: Buffer) => {
                data += chunk.toString();
            });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.choices && json.choices.length > 0 && json.choices[0].message?.content) {
                        resolve(json.choices[0].message.content.trim());
                    } else {
                        console.error('[Simple Translation] DeepSeek API error:', data);
                        resolve(null);
                    }
                } catch (e) {
                    console.error('[Simple Translation] DeepSeek parse error:', e);
                    resolve(null);
                }
            });
        });

        req.on('error', (err: Error) => {
            console.error('[Simple Translation] DeepSeek network error:', err.message);
            resolve(null);
        });

        req.write(body);
        req.end();
    });
}

/**
 * Translate using MyMemory API (free, no key).
 */
function mymemoryTranslate(
    text: string,
    from: string,
    to: string,
    apiUrl: string
): Promise<string | null> {
    const langpair = `${from}|${to}`;
    const encodedText = encodeURIComponent(text);
    const separator = apiUrl.includes('?') ? '&' : '?';
    const url = `${apiUrl}${separator}q=${encodedText}&langpair=${langpair}`;

    return new Promise<string | null>((resolve) => {
        https.get(url, (res) => {
            let body = '';
            res.on('data', (chunk: Buffer) => {
                body += chunk.toString();
            });
            res.on('end', () => {
                try {
                    const data: TranslationApiResponse = JSON.parse(body);
                    if (data.responseStatus === 200 && data.responseData?.translatedText) {
                        resolve(data.responseData.translatedText);
                    } else {
                        console.error('[Simple Translation] MyMemory API error:', body);
                        resolve(null);
                    }
                } catch (e) {
                    console.error('[Simple Translation] MyMemory parse error:', e);
                    resolve(null);
                }
            });
        }).on('error', (err: Error) => {
            console.error('[Simple Translation] MyMemory network error:', err.message);
            resolve(null);
        });
    });
}

/**
 * Fetch IPA phonetic transcription for a single English word via DeepSeek.
 * Only called for single English words.
 */
export function fetchPhonetic(word: string, apiKey: string, model: string): Promise<string | null> {
    if (!word || word.includes(' ') || word.length > 50 || !apiKey) {
        return Promise.resolve(null);
    }

    const body = JSON.stringify({
        model,
        messages: [
            {
                role: 'system',
                content: 'You are a phonetic transcription expert. Provide ONLY the IPA phonetic transcription of the given English word. Output ONLY the IPA, nothing else. Example: /ˈfəʊnɛtɪk/'
            },
            { role: 'user', content: word }
        ],
        max_tokens: 64,
        temperature: 0,
    });

    return new Promise<string | null>((resolve) => {
        const req = https.request({
            hostname: 'api.deepseek.com',
            port: 443,
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            let data = '';
            res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.choices?.[0]?.message?.content) {
                        resolve(json.choices[0].message.content.trim());
                    } else {
                        resolve(null);
                    }
                } catch {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.write(body);
        req.end();
    });
}
