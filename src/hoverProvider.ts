import * as vscode from 'vscode';
import { getSettings, detectLanguage } from './config';
import { translate, fetchPhonetic } from './translator';
import { getEnglishReadAloudText } from './readAloud';
import { LanguageCode } from './types';

/** Cached translation for shortcut-triggered hover display. */
interface PendingHover {
    markdown: vscode.MarkdownString;
    range: vscode.Range;
}

/**
 * HoverProvider that shows translation on hover (auto mode)
 * or on command trigger (shortcut mode — shows Markdown tooltip).
 */
export class SimpleTranslationHoverProvider implements vscode.HoverProvider {
    private pendingHover: PendingHover | null = null;

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        // Check for a pending shortcut-triggered hover first.
        if (this.pendingHover) {
            const ph = this.pendingHover;
            if (ph.range.contains(position) && document.uri.toString() === vscode.window.activeTextEditor?.document.uri.toString()) {
                this.pendingHover = null;
                return new vscode.Hover(ph.markdown, ph.range);
            }
            // Stale cache — discard.
            this.pendingHover = null;
        }

        // In shortcut mode, don't auto-translate on hover.
        const settings = getSettings();
        if (settings.hoverMode !== 'auto') {
            return null;
        }

        return this.getTranslationHover(document, position);
    }

    /** Perform translation and return a Markdown Hover. */
    private async getTranslationHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | null> {
        const settings = getSettings();

        let wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange || wordRange.isEmpty) {
            return null;
        }

        // Expand to selection if it overlaps this position.
        const selection = vscode.window.activeTextEditor?.selection;
        if (selection && !selection.isEmpty && selection.contains(position)) {
            wordRange = selection;
        }

        const text = document.getText(wordRange).trim();
        if (!text || text.length > 500) {
            return null;
        }

        const from: LanguageCode = settings.defaultFrom;
        const to: LanguageCode = settings.defaultTo;

        // Fetch translation and phonetic (if single English word) in parallel.
        const detectedFrom = from === 'auto' ? detectLanguage(text) : from;
        const isSingleEnWord = detectedFrom === 'en' && !text.includes(' ') && text.length <= 50;
        const [result, phonetic] = await Promise.all([
            translate(text, from, to, settings),
            isSingleEnWord ? fetchPhonetic(text, settings.deepseekApiKey, settings.deepseekModel) : Promise.resolve(null),
        ]);

        if (!result || result === text) {
            return null;
        }

        return buildMarkdownHover(text, result, phonetic, from, to, wordRange);
    }

    /**
     * Shortcut-triggered translation. Translates selection and shows result
     * as a Markdown hover tooltip (same style as auto-mode hover).
     */
    async showShortcutPanel(_extensionUri: vscode.Uri): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage('请选中要翻译的文字。');
            return;
        }

        const text = editor.document.getText(selection).trim();
        if (!text || text.length > 500) {
            vscode.window.showInformationMessage('选中文字过长（最多500字符）。');
            return;
        }

        const settings = getSettings();
        const from: LanguageCode = settings.defaultFrom;
        const to: LanguageCode = settings.defaultTo;

        const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusItem.text = '$(sync~spin) 翻译中...';
        statusItem.show();

        const detectedFrom = from === 'auto' ? detectLanguage(text) : from;
        const isSingleEnWord = detectedFrom === 'en' && !text.includes(' ') && text.length <= 50;
        const [result, phonetic] = await Promise.all([
            translate(text, from, to, settings),
            isSingleEnWord ? fetchPhonetic(text, settings.deepseekApiKey, settings.deepseekModel) : Promise.resolve(null),
        ]);
        statusItem.dispose();

        if (!result || result === text) {
            vscode.window.showErrorMessage('翻译失败，请检查网络连接。');
            return;
        }

        const markdown = buildMarkdownHoverContent(text, result, phonetic, from, to);
        this.pendingHover = { markdown, range: selection };
        await vscode.commands.executeCommand('editor.action.showHover');
    }
}

/** Build Markdown hover content and wrap it in a vscode.Hover. */
function buildMarkdownHover(
    original: string,
    translated: string,
    phonetic: string | null,
    from: LanguageCode,
    to: LanguageCode,
    range: vscode.Range
): vscode.Hover {
    const markdown = buildMarkdownHoverContent(original, translated, phonetic, from, to);
    return new vscode.Hover(markdown, range);
}

/** Build the MarkdownString for a translation result. */
function buildMarkdownHoverContent(
    original: string,
    translated: string,
    phonetic: string | null,
    from: LanguageCode,
    to: LanguageCode
): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.supportHtml = true;
    markdown.isTrusted = true;

    const langLabel = to === 'zh' ? '🇨🇳 中文' : '🇬🇧 English';
    markdown.appendMarkdown(`**${langLabel}**\n\n`);
    markdown.appendMarkdown(`${translated}\n\n---\n`);

    // Original text line: show text + optional phonetic.
    let originalLine = `*${original.substring(0, 100)}*`;
    if (phonetic) {
        originalLine += `  ${phonetic}`;
    }
    const parts = [originalLine];

    const readAloudText = getEnglishReadAloudText({ original, translated, from, to });
    if (readAloudText) {
        const args = encodeURIComponent(JSON.stringify([{ text: readAloudText }]));
        parts.push(`[🔊 朗读](command:simple-translation._speakTts?${args})`);
    }
    markdown.appendMarkdown(parts.join('  ·  '));

    return markdown;
}
