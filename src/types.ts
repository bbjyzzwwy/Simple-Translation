/**
 * Shared TypeScript types for Simple Translation extension.
 */

/** Language codes supported for translation. */
export type LanguageCode = 'zh' | 'en' | 'auto';

/** Request to translate text. */
export interface TranslationRequest {
    text: string;
    from: LanguageCode;
    to: LanguageCode;
}

/** Response from the translation API (MyMemory format). */
export interface TranslationApiResponse {
    responseData: {
        translatedText: string;
        match: number;
    };
    responseStatus: number;
    matches?: Array<{
        segment: string;
        translation: string;
        match: number;
    }>;
}

/** Message sent from WebView to the extension. */
export interface WebViewMessage {
    type: 'translate' | 'speak' | 'getSettings' | 'copy';
    text?: string;
    from?: LanguageCode;
    to?: LanguageCode;
}

/** Message sent from the extension to a WebView. */
export interface ExtensionMessage {
    type: 'translationResult' | 'error' | 'settings' | 'phonetic' | 'speakState';
    original?: string;
    translated?: string;
    phonetic?: string;
    speakText?: string | null;
    speaking?: boolean;
    from?: LanguageCode;
    to?: LanguageCode;
    message?: string;
    settings?: AppSettings;
}

/** Extension configuration settings. */
export interface AppSettings {
    hoverMode: 'auto' | 'shortcut';
    apiEndpoint: string;
    deepseekApiKey: string;
    deepseekModel: string;
    youdaoAppId: string;
    youdaoAppSecret: string;
    youdaoVoice: string;
    defaultFrom: LanguageCode;
    defaultTo: LanguageCode;
    hoverPanelWidth: number;
}
