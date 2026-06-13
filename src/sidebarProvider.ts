import * as vscode from 'vscode';
import { getSettings, detectLanguage } from './config';
import { translate, fetchPhonetic } from './translator';
import { speakText } from './tts';
import { WebViewMessage, LanguageCode } from './types';
import { getEnglishReadAloudText } from './readAloud';

/**
 * WebviewViewProvider for the sidebar translation panel.
 */
export class SidebarTranslationProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _speaking = false;

    constructor(private readonly extensionUri: vscode.Uri) {}

    /**
     * Called by VSCode when the sidebar view is first created or becomes visible.
     */
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this.getSidebarHtml(webviewView.webview);

        // Handle messages from the WebView.
        webviewView.webview.onDidReceiveMessage(
            async (message: WebViewMessage) => {
                switch (message.type) {
                    case 'translate':
                        await this.handleTranslate(message.text || '');
                        break;
                    case 'speak':
                        if (message.text && !this._speaking) {
                            const settings = getSettings();
                            if (!settings.youdaoAppId || !settings.youdaoAppSecret) {
                                this.postMessage({ type: 'error', message: '请先配置有道 TTS (youdaoAppId / youdaoAppSecret)' });
                                break;
                            }
                            this._speaking = true;
                            this.postMessage({ type: 'speakState', speaking: true });
                            const lang = message.to === 'en' ? 'en' : 'zh';
                            speakText(message.text, lang, settings.youdaoAppId, settings.youdaoAppSecret, settings.youdaoVoice).finally(() => {
                                this._speaking = false;
                                this.postMessage({ type: 'speakState', speaking: false });
                            });
                        }
                        break;
                    case 'getSettings':
                        this.sendSettings();
                        break;
                }
            }
        );

        // Send initial settings when the view becomes visible.
        this.sendSettings();
    }

    /**
     * Handle a translation request from the sidebar WebView.
     * Auto-detects the source language: Chinese → English, otherwise → Chinese.
     */
    private async handleTranslate(text: string): Promise<void> {
        if (!text.trim()) {
            this.postMessage({ type: 'error', message: 'Please enter text to translate.' });
            return;
        }

        const detected = detectLanguage(text);
        const from: LanguageCode = detected;
        const to: LanguageCode = detected === 'zh' ? 'en' : 'zh';

        const settings = getSettings();

        // Fetch phonetic in parallel with translation (single English word only).
        const needPhonetic = from === 'en' && !text.includes(' ') && text.length <= 50 && !!settings.deepseekApiKey;
        const [result, phonetic] = await Promise.all([
            translate(text, from, to, settings),
            needPhonetic ? fetchPhonetic(text, settings.deepseekApiKey, settings.deepseekModel) : Promise.resolve(null),
        ]);

        if (result) {
            const readAloudText = getEnglishReadAloudText({ original: text, translated: result, from, to });

            this.postMessage({
                type: 'translationResult',
                original: text,
                translated: result,
                originalPhonetic: phonetic || '',
                speakText: readAloudText,
                from,
                to,
            });
        } else {
            this.postMessage({
                type: 'error',
                message: 'Translation failed. Please check your network connection.',
            });
        }
    }

    /**
     * Send current extension settings to the WebView.
     */
    private sendSettings(): void {
        const settings = getSettings();
        this.postMessage({
            type: 'settings',
            settings,
        });
    }

    /**
     * Post a message to the sidebar WebView.
     */
    private postMessage(message: Record<string, unknown>): void {
        this._view?.webview.postMessage(message);
    }

    /**
     * Generate the sidebar panel HTML.
     */
    private getSidebarHtml(webview: vscode.Webview): string {
        const cspSource = webview.cspSource;

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:;">
<title>Simple Translation</title>
<style>
    :root {
        --bg: var(--vscode-sideBar-background);
        --fg: var(--vscode-sideBar-foreground);
        --input-bg: var(--vscode-input-background);
        --input-fg: var(--vscode-input-foreground);
        --input-border: var(--vscode-input-border);
        --btn-bg: var(--vscode-button-background);
        --btn-fg: var(--vscode-button-foreground);
        --btn-hover: var(--vscode-button-hoverBackground);
        --btn-sec-bg: var(--vscode-button-secondaryBackground);
        --btn-sec-fg: var(--vscode-button-secondaryForeground);
        --btn-sec-hover: var(--vscode-button-secondaryHoverBackground);
        --result-bg: var(--vscode-textBlockQuote-background);
        --desc-fg: var(--vscode-descriptionForeground);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: var(--vscode-font-family, -apple-system, sans-serif);
        font-size: var(--vscode-font-size, 13px);
        color: var(--fg);
        background: var(--bg);
        padding: 12px;
    }
    .header {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
    }
    textarea {
        width: 100%;
        min-height: 80px;
        padding: 8px 10px;
        font-family: inherit;
        font-size: 13px;
        color: var(--input-fg);
        background: var(--input-bg);
        border: 1px solid var(--input-border, transparent);
        border-radius: 4px;
        resize: vertical;
        outline: none;
    }
    textarea:focus { border-color: var(--vscode-focusBorder); }
    .translate-btn {
        width: 100%;
        padding: 8px;
        font-size: 13px;
        font-weight: 500;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background: var(--btn-bg);
        color: var(--btn-fg);
        margin-top: 10px;
    }
    .translate-btn:hover { background: var(--btn-hover); }
    .translate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .result-area { margin-top: 14px; display: none; }
    .result-area.visible { display: block; }
    .result-section { margin-bottom: 12px; }
    .result-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
    }
    .result-label {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--desc-fg);
    }
    .result-text {
        font-size: 13px;
        line-height: 1.6;
        padding: 10px 12px;
        background: var(--result-bg);
        border-radius: 4px;
        word-break: break-word;
    }
    .phonetic-text {
        display: inline-block;
        font-size: 12px;
        color: var(--desc-fg);
        margin-top: 4px;
        margin-left: 2px;
    }
    .action-btn {
        padding: 3px 10px;
        font-size: 11px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background: var(--btn-sec-bg);
        color: var(--btn-sec-fg);
    }
    .action-btn:hover { background: var(--btn-sec-hover); }
    .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .speaking-indicator {
        font-size: 11px;
        color: var(--desc-fg);
        margin-left: 6px;
        display: none;
    }
    .speaking-indicator.visible { display: inline; }
    .error-msg {
        color: var(--vscode-errorForeground);
        font-size: 12px;
        margin-top: 8px;
        display: none;
    }
    .error-msg.visible { display: block; }
    .loading {
        display: none;
        text-align: center;
        margin-top: 12px;
        color: var(--desc-fg);
        font-size: 12px;
    }
    .loading.visible { display: block; }
</style>
</head>
<body>
    <div class="header">🌐 Simple Translation</div>

    <textarea id="inputText" placeholder="输入要翻译的文字... (Enter 翻译, Alt+Enter 换行)"></textarea>

    <button class="translate-btn" id="translateBtn" onclick="doTranslate()">翻译</button>

    <div class="loading" id="loading">⏳ 翻译中...</div>
    <div class="error-msg" id="errorMsg"></div>

    <div class="result-area" id="resultArea">
        <div class="result-section">
            <div class="result-section-header">
                <div class="result-label">📝 原文</div>
                <span class="speaking-indicator" id="speakOriginalIndicator">⏳ 正在朗读...</span>
                <button class="action-btn" id="speakOriginalBtn" onclick="speakResult()" style="display:none">🔊 朗读</button>
            </div>
            <div class="result-text" id="originalText"></div>
            <div class="phonetic-text" id="originalPhoneticText" style="display:none"></div>
        </div>
        <div class="result-section">
            <div class="result-section-header">
                <div class="result-label">📖 译文</div>
                <span class="speaking-indicator" id="speakTranslatedIndicator">⏳ 正在朗读...</span>
                <button class="action-btn" id="speakTranslatedBtn" onclick="speakResult()" style="display:none">🔊 朗读</button>
            </div>
            <div class="result-text" id="translatedText"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let lastResult = null;
        let voicesReady = false;

        // Request settings on load.
        vscode.postMessage({ type: 'getSettings' });

        // Listen for messages from the extension.
        window.addEventListener('message', (event) => {
            const msg = event.data;
            switch (msg.type) {
                case 'translationResult':
                    showResult(msg.original, msg.translated, msg.originalPhonetic, msg.from, msg.to, msg.speakText);
                    break;
                case 'speakState':
                    setSpeaking(msg.speaking);
                    break;
                case 'error':
                    showError(msg.message);
                    break;
            }
        });

        function doTranslate() {
            const text = document.getElementById('inputText').value.trim();
            if (!text) {
                showError('请输入要翻译的文字。');
                return;
            }

            document.getElementById('loading').classList.add('visible');
            document.getElementById('errorMsg').classList.remove('visible');
            document.getElementById('resultArea').classList.remove('visible');
            document.getElementById('translateBtn').disabled = true;

            vscode.postMessage({ type: 'translate', text });
        }

        function showResult(original, translated, originalPhonetic, from, to, speakText) {
            document.getElementById('loading').classList.remove('visible');
            document.getElementById('errorMsg').classList.remove('visible');
            document.getElementById('translateBtn').disabled = false;

            document.getElementById('originalText').textContent = original;
            document.getElementById('translatedText').textContent = translated;
            document.getElementById('resultArea').classList.add('visible');

            setSpeaking(false);
            document.getElementById('speakOriginalBtn').style.display = (speakText && from === 'en') ? '' : 'none';
            document.getElementById('speakTranslatedBtn').style.display = (speakText && to === 'en') ? '' : 'none';

            // Original text phonetic (only for single English words).
            const ophEl = document.getElementById('originalPhoneticText');
            ophEl.style.display = originalPhonetic ? 'block' : 'none';
            if (originalPhonetic) ophEl.textContent = originalPhonetic;

            lastResult = { original, translated, originalPhonetic, from, to, speakText };
        }

        function showError(msg) {
            document.getElementById('loading').classList.remove('visible');
            document.getElementById('translateBtn').disabled = false;
            document.getElementById('errorMsg').textContent = msg;
            document.getElementById('errorMsg').classList.add('visible');
        }

        let isSpeaking = false;

        function setSpeaking(speaking) {
            isSpeaking = speaking;
            if (!lastResult || !lastResult.speakText) {
                document.getElementById('speakOriginalBtn').disabled = speaking;
                document.getElementById('speakTranslatedBtn').disabled = speaking;
                document.getElementById('speakOriginalIndicator').classList.remove('visible');
                document.getElementById('speakTranslatedIndicator').classList.remove('visible');
                return;
            }
            const visibleBtnId = (lastResult && lastResult.from === 'en') ? 'speakOriginalBtn' : 'speakTranslatedBtn';
            const visibleIndId = (lastResult && lastResult.from === 'en') ? 'speakOriginalIndicator' : 'speakTranslatedIndicator';
            document.getElementById('speakOriginalBtn').disabled = speaking;
            document.getElementById('speakTranslatedBtn').disabled = speaking;
            document.getElementById('speakOriginalIndicator').classList.toggle('visible', speaking && visibleIndId === 'speakOriginalIndicator');
            document.getElementById('speakTranslatedIndicator').classList.toggle('visible', speaking && visibleIndId === 'speakTranslatedIndicator');
            if (speaking) {
                document.getElementById(visibleBtnId).style.display = 'none';
            } else {
                document.getElementById(visibleBtnId).style.display = '';
            }
        }

        function speakResult() {
            if (!lastResult || isSpeaking) return;
            vscode.postMessage({ type: 'speak', text: lastResult.speakText, to: 'en' });
        }

        // --- Keyboard: Enter to translate, Alt+Enter to newline ---
        document.getElementById('inputText').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.altKey) {
                    // Alt+Enter: insert newline.
                    e.preventDefault();
                    const ta = document.getElementById('inputText');
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    ta.value = ta.value.substring(0, start) + '\\n' + ta.value.substring(end);
                    ta.selectionStart = ta.selectionEnd = start + 1;
                } else {
                    // Enter alone: translate.
                    e.preventDefault();
                    doTranslate();
                }
            }
        });

    </script>
</body>
</html>`;
    }
}
