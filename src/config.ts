import * as vscode from 'vscode';
import { AppSettings, LanguageCode } from './types';

/**
 * Read all extension settings from VSCode configuration.
 */
export function getSettings(): AppSettings {
    const config = vscode.workspace.getConfiguration('simple-translation');
    return {
        hoverMode: config.get<'auto' | 'shortcut'>('hoverMode', 'auto'),
        apiEndpoint: config.get<string>('apiEndpoint', 'https://api.mymemory.translated.net/get'),
        deepseekApiKey: config.get<string>('deepseekApiKey', ''),
        deepseekModel: config.get<string>('deepseekModel', 'deepseek-chat'),
        youdaoAppId: config.get<string>('youdaoAppId', ''),
        youdaoAppSecret: config.get<string>('youdaoAppSecret', ''),
        youdaoVoice: config.get<string>('youdaoVoice', 'youxiaoying'),
        defaultFrom: config.get<LanguageCode>('defaultFrom', 'auto'),
        defaultTo: config.get<LanguageCode>('defaultTo', 'zh'),
        hoverPanelWidth: config.get<number>('hoverPanelWidth', 420),
    };
}

/**
 * Detect the most likely language of the given text.
 * Returns 'zh' if the text contains mostly CJK characters, otherwise 'en'.
 */
export function detectLanguage(text: string): LanguageCode {
    let cjkCount = 0;
    for (const ch of text) {
        const code = ch.codePointAt(0);
        if (code !== undefined && isCJK(code)) {
            cjkCount++;
        }
    }
    // If more than 30% of characters are CJK, treat as Chinese.
    return cjkCount > text.length * 0.3 ? 'zh' : 'en';
}

/**
 * Check if a Unicode code point is in the CJK range.
 */
function isCJK(code: number): boolean {
    return (
        (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Unified Ideographs Extension A
        (code >= 0x20000 && code <= 0x2A6DF) || // CJK Unified Ideographs Extension B
        (code >= 0xF900 && code <= 0xFAFF) ||   // CJK Compatibility Ideographs
        (code >= 0x2F800 && code <= 0x2FA1F)    // CJK Compatibility Ideographs Supplement
    );
}
