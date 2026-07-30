import React from 'react';

// Emoji flags (the Nationality lookup's `flag` field) render as a literal
// two-letter code on Windows — Segoe UI Emoji has no flag glyphs, so
// "🇵🇰" shows up as the text "PK" instead of an actual flag. Render a real
// flag image from the ISO 3166-1 alpha-2 code instead, so it looks right
// everywhere regardless of OS/font support.
export default function FlagIcon({ code, size = 16, style }) {
  if (!code) return null;
  const cdnWidth = size <= 16 ? 20 : size <= 28 ? 40 : 80;
  return (
    <img
      src={`https://flagcdn.com/w${cdnWidth}/${code.toLowerCase()}.png`}
      alt=""
      width={size}
      style={{ display: 'inline-block', borderRadius: 2, verticalAlign: 'middle', height: 'auto', flexShrink: 0, ...style }}
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
}
