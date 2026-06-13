import * as vscode from 'vscode';
import { SimpleTranslationHoverProvider } from './hoverProvider';
import { SidebarTranslationProvider } from './sidebarProvider';
import { speakText } from './tts';
import { getSettings } from './config';

/** Prevents overlapping TTS from the _speakTts command. */
let ttsActive = false;

/**
 * Activate the extension.
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('[Simple Translation] Extension activated.');

    const hoverProvider = new SimpleTranslationHoverProvider();
    const sidebarProvider = new SidebarTranslationProvider(context.extensionUri);

    // Hover provider (auto mode).
    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider)
    );

    // Sidebar WebView.
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('simple-translation.sidebarView', sidebarProvider)
    );

    // Shortcut hover command.
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'simple-translation.translateHoverShortcut',
            () => hoverProvider.showShortcutPanel(context.extensionUri)
        )
    );

    // Open sidebar command.
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'simple-translation.openSidebar',
            () => vscode.commands.executeCommand('simple-translation-sidebar.focus')
        )
    );

    // Hover Markdown TTS command.
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'simple-translation._speakTts',
            (params: { text: string }) => {
                if (!params?.text || ttsActive) {
                    return;
                }
                const settings = getSettings();
                if (!settings.youdaoAppId || !settings.youdaoAppSecret) {
                    return;
                }
                ttsActive = true;
                const status = vscode.window.setStatusBarMessage('⏳ 朗读中...');
                speakText(params.text, 'en', settings.youdaoAppId, settings.youdaoAppSecret, settings.youdaoVoice).finally(() => {
                    ttsActive = false;
                    status.dispose();
                });
            }
        )
    );
}

/**
 * Deactivate the extension.
 */
export function deactivate(): void {
    console.log('[Simple Translation] Extension deactivated.');
}
