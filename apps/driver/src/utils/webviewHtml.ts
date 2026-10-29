/** 與 CRM wrapWebviewHtml 一致：片段 HTML 包成完整文件供 WebView 顯示 */
export function wrapWebviewHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return trimmed;
  if (/^\s*<!DOCTYPE/i.test(trimmed) || /^\s*<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 16px; line-height: 1.6; margin: 0; color: #222; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${trimmed}
</body>
</html>`;
}
