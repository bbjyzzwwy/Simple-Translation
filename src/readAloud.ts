import { detectLanguage } from './config';
import { LanguageCode } from './types';

interface ReadAloudContext {
    original: string;
    translated: string;
    from: LanguageCode;
    to: LanguageCode;
}

/**
 * The extension reads the English side aloud. When the source language is
 * auto-detected, resolve it from the original text before choosing a side.
 */
export function getEnglishReadAloudText(context: ReadAloudContext): string | null {
    const sourceLanguage = context.from === 'auto'
        ? detectLanguage(context.original)
        : context.from;

    const text = sourceLanguage === 'en'
        ? context.original
        : context.to === 'en'
            ? context.translated
            : '';

    const trimmed = text.trim();
    return trimmed ? trimmed : null;
}
