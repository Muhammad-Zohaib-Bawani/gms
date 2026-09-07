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

// Drop-in `formatOptionLabel` for a nationality <Select> — pass options shaped
// as { value, label, code } (code = ISO alpha-2) and this renders the real
// flag image next to the label instead of a dropdown full of raw emoji/text
// codes. `label` still does the keyboard-search matching react-select expects.
export function nationalityOptionLabel(opt) {
  return opt?.code ? (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <FlagIcon code={opt.code} size={14} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
    </span>
  ) : opt?.label;
}
