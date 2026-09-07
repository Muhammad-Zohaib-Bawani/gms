// The shape codes the venue canvas renderer actually understands. `code` is not
// free text: it drives which SVG a palette entry draws (see
// views/venue/canvas/CanvasElement.jsx), and an unrecognised code silently
// falls through to the pitch/area shape rather than erroring — which is exactly
// why the Element Types lookup offers these as a dropdown instead of an input.
//
// Keep in sync with CanvasElement.jsx's dispatch and ELEMENT_META in
// views/venue/venueHelpers.js.
export const ELEMENT_TYPE_CODE = {
  ROUND: 'round',
  RECT: 'rect',
  STADIUM: 'stadium',
  STAGE: 'stage',
  PITCH: 'pitch',
};

export const ELEMENT_TYPE_CODE_OPTIONS = [
  { value: ELEMENT_TYPE_CODE.ROUND,   label: { en: 'Round table',    ar: 'طاولة دائرية' } },
  { value: ELEMENT_TYPE_CODE.RECT,    label: { en: 'Rectangle table', ar: 'طاولة مستطيلة' } },
  { value: ELEMENT_TYPE_CODE.STADIUM, label: { en: 'Stadium seating', ar: 'مدرجات' } },
  { value: ELEMENT_TYPE_CODE.STAGE,   label: { en: 'Stage',           ar: 'منصة' } },
  { value: ELEMENT_TYPE_CODE.PITCH,   label: { en: 'Pitch / area',    ar: 'ملعب / مساحة' } },
];
