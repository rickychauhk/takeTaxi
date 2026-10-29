/** Load stored HTML into the visual editor (unwrap full documents to body) */
export function htmlForEditor(stored: string): string {
  const trimmed = stored.trim();
  if (!trimmed) return '';
  if (/^\s*<!DOCTYPE/i.test(trimmed) || /^\s*<html[\s>]/i.test(trimmed)) {
    try {
      const doc = new DOMParser().parseFromString(trimmed, 'text/html');
      return doc.body?.innerHTML.trim() ?? trimmed;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

/** Wrap fragment HTML for mobile WebView if not already a full document */
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
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 16px; line-height: 1.6; margin: 0; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${trimmed}
</body>
</html>`;
}
