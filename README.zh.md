<p align="center">
  <img src="https://raw.githubusercontent.com/bbjyzzwwy/Simple-Translation/main/media/icon.png" alt="Logo" width="128" height="128">
</p>

<h1 align="center">Simple Translation</h1>

<p align="center">
  <strong>中英互译插件 — 支持悬停翻译、快捷键翻译、侧边栏翻译面板，集成神经网络语音合成。</strong>
</p>

<p align="center">
  <a href="https://github.com/bbjyzzwwy/Simple-Translation/blob/main/README.md">English</a> |
  <a href="https://github.com/bbjyzzwwy/Simple-Translation/blob/main/README.zh.md">中文</a>
</p>

## 演示

![Demo](https://raw.githubusercontent.com/bbjyzzwwy/Simple-Translation/main/docs/demo.gif)

---

## 功能

- **悬停翻译** — 鼠标悬停在文字上即可看到翻译结果。单个单词显示词典式多义项解释和 IPA 音标。
- **快捷键翻译** — 选中文字，按 `Ctrl+Shift+T` 弹出翻译提示。
- **侧边栏翻译面板** — 输入文字自动识别语言，单个单词显示词典释义和音标。
- **神经网络朗读** — 🔊 朗读英文，使用有道神经网络 TTS，发音自然流畅。
- **词典模式** — 单个单词调用 DeepSeek 生成带词性的多义项词典式释义。
- **IPA 音标** — 单英文词自动显示国际音标（DeepSeek 生成）。

## 翻译 API

| API | 使用条件 | 配置 |
|-----|---------|------|
| **DeepSeek** | 配置后优先使用 | 填入 `deepseekApiKey` |
| **MyMemory** | 无需 Key，自动降级 | 无需配置 |

## 语音合成

| 引擎 | 配置 |
|------|------|
| **有道 TTS** | 填入 `youdaoAppId` + `youdaoAppSecret` |

## 设置项

| 设置 | 默认值 | 说明 |
|---------|---------|------|
| `simple-translation.hoverMode` | `auto` | `auto` 悬停翻译，`shortcut` 仅快捷键翻译 |
| `simple-translation.deepseekApiKey` | `""` | DeepSeek API 密钥（翻译 + 音标） |
| `simple-translation.deepseekModel` | `deepseek-chat` | DeepSeek 模型 |
| `simple-translation.youdaoAppId` | `""` | 有道应用 ID（TTS） |
| `simple-translation.youdaoAppSecret` | `""` | 有道应用密钥（TTS） |
| `simple-translation.youdaoVoice` | `youxiaoying` | TTS 音色 |
| `simple-translation.defaultFrom` | `auto` | 源语言 |
| `simple-translation.defaultTo` | `zh` | 目标语言 |

## 环境要求

- VS Code `^1.85.0`
- **目前仅支持 Linux**：需要 `ffmpeg` + `pulseaudio-utils` 播放音频

```bash
# Ubuntu/Debian
sudo apt install ffmpeg pulseaudio-utils
```

## 开发

```bash
npm install
npm run compile
npm run package
```

---

**License:** [MIT](LICENSE)
