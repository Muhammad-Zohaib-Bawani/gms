import React, { useState, useMemo } from 'react';
import { toArDigits } from '../i18n/translations.js';
import { Icon } from '../components/Icons.jsx';
import Modal from '../components/ui/Modal.jsx';
import Select from '../components/ui/Select.jsx';
import AddVenueModal from './venue/AddVenueModal.jsx';
import VenueToolbar from './venue/VenueToolbar.jsx';
import ElementPalette from './venue/ElementPalette.jsx';
import VenueCanvas from './venue/canvas/VenueCanvas.jsx';
import ConfigPanel from './venue/ConfigPanel.jsx';
import useVenueEditor from './venue/useVenueEditor.js';
import { VENUE_CATEGORY_OPTIONS } from './venue/venueHelpers.js';

export default function VenueConfigView({ lang, activeEventId }) {
  const isAr = lang === 'ar';
  const ad = s => isAr ? toArDigits(String(s)) : String(s);

  const t = isAr ? {
    title: 'تهيئة المكان', sub: 'صمّم مخطط القاعة بالسحب والإفلات',
    palette: 'أنواع العناصر',
    roundDesc: 'مقاعد حول المحيط', rectDesc: 'مقاعد على الجانبين',
    stadiumDesc: 'صفوف × مقاعد في الصف', stageDesc: 'منصة العرض الرئيسية',
    pitchDesc: 'منطقة مفتوحة أو معرض',
    configure: 'تهيئة', label: 'اسم العنصر', seats: 'عدد المقاعد',
    seatsPerSide: 'مقاعد في كل جانب', rows: 'الصفوف', seatsPerRow: 'مقاعد في كل صف',
    deleteTable: 'حذف العنصر', save: 'حفظ التخطيط', saved: 'تم الحفظ ✓',
    clearAll: 'مسح الكل', confirm: 'تأكيد', cancel: 'إلغاء',
    clearMsg: 'مسح كل العناصر في هذا المكان؟',
    dragHint: 'اسحب عنصراً من القائمة إلى اللوحة، وحرّك العناصر بالسحب',
    noSelection: 'انقر على عنصر للتهيئة', totalSeats: 'إجمالي المقاعد', tables: 'عناصر',
    venues: 'الأماكن', newVenue: 'مكان جديد',
    deleteVenue: 'حذف المكان', deleteVenueMsg: 'حذف هذا المكان وجميع عناصره؟',
    deleteSeats: 'حذف مقاعد', exitDeleteMode: 'إنهاء الحذف',
    deleteSeatsHint: 'انقر على المقعد لتحديده، أو × لحذفه',
    noStageSeats: 'لا مقاعد فردية على المسرح', noPitchSeats: 'لا مقاعد فردية في منطقة الملعب',
    stageWidth: 'عرض المسرح', stageDepth: 'عمق المسرح',
    areaWidth: 'عرض المنطقة', areaHeight: 'ارتفاع المنطقة',
    seatNumber: 'رقم المقعد', rotation: 'الدوران', color: 'اللون',
    selectedSeat: 'المقعد المحدد', deselectSeat: 'إلغاء التحديد',
    seatInfo: 'معلومات المقعد', disableSeat: 'تعطيل المقعد', enableSeat: 'تفعيل المقعد',
    seatColor: 'لون المقعد', viewFullscreen: 'عرض ملء الشاشة',
    canvasSize: 'حجم اللوحة', canvasSizeAuto: 'تلقائي', canvasSizeAutoHint: 'تلقائي حسب العناصر',
    addBlock: 'إضافة قسم', addBlockMsg: 'أضف قسماً جديداً (منصّة/مدرّج) إلى هذا المخطط',
    blockLabel: 'اسم القسم', blockCategory: 'الفئة (اختياري)', add: 'إضافة', adding: 'جارٍ الإضافة…',
  } : {
    title: 'Venue Configuration', sub: 'Design the floor plan using drag-and-drop',
    palette: 'Element types',
    roundDesc: 'Seats around perimeter', rectDesc: 'Seats on both long sides',
    stadiumDesc: 'Rows × seats per row', stageDesc: 'Performance platform',
    pitchDesc: 'Open area or exhibition space',
    configure: 'Configure', label: 'Label', seats: 'Seats',
    seatsPerSide: 'Seats per side', rows: 'Rows', seatsPerRow: 'Seats per row',
    deleteTable: 'Remove from plan', save: 'Save layout', saved: 'Saved ✓',
    clearAll: 'Clear all', confirm: 'Confirm', cancel: 'Cancel',
    clearMsg: 'Remove all elements from this venue?',
    dragHint: 'Drag a type from the palette onto the canvas, then reposition by dragging.',
    noSelection: 'Click an element to configure it', totalSeats: 'Total seats', tables: 'elements',
    venues: 'Venues', newVenue: 'New Venue',
    deleteVenue: 'Delete venue', deleteVenueMsg: 'Delete this venue and all its elements?',
    deleteSeats: 'Delete seats', exitDeleteMode: 'Exit delete mode',
    deleteSeatsHint: 'Click a seat to select it, or × to remove it',
    noStageSeats: 'No individual seats on stage', noPitchSeats: 'No individual seats in pitch area',
    stageWidth: 'Stage width', stageDepth: 'Stage depth',
    areaWidth: 'Area width', areaHeight: 'Area height',
    seatNumber: 'Seat number', rotation: 'Rotation', color: 'Color',
    selectedSeat: 'Selected seat', deselectSeat: 'Deselect',
    seatInfo: 'Seat info', disableSeat: 'Disable seat', enableSeat: 'Enable seat',
    seatColor: 'Seat color', viewFullscreen: 'View fullscreen',
    canvasSize: 'Canvas size', canvasSizeAuto: 'Auto', canvasSizeAutoHint: 'Auto-fits elements',
    addBlock: 'Add Block', addBlockMsg: 'Add a new block (stand/stadium section) to this layout',
    blockLabel: 'Block label', blockCategory: 'Category (optional)', add: 'Add', adding: 'Adding…',
  };

  const descByCode = {
    round: t.roundDesc, rect: t.rectDesc, stadium: t.stadiumDesc, stage: t.stageDesc, pitch: t.pitchDesc,
  };

  const ed = useVenueEditor({ lang, activeEventId });
  const BLANK_BLOCK_FORM = { label: '', category: '', rows: 10, seatsPerRow: 20 };
  const [blockForm, setBlockForm] = useState(BLANK_BLOCK_FORM);
  const blockCategoryOptions = useMemo(
    () => VENUE_CATEGORY_OPTIONS.map(c => ({ value: c.value, label: isAr ? c.label.ar : c.label.en })),
    [isAr],
  );

  async function submitAddBlock() {
    const ok = await ed.addVenueBlock({
      label: blockForm.label,
      category: blockForm.category,
      rows: +blockForm.rows || 1,
      seatsPerRow: +blockForm.seatsPerRow || 1,
    });
    if (ok) setBlockForm(BLANK_BLOCK_FORM);
  }

  function openFullscreenView() {
    const params = new URLSearchParams({
      screen: 'venueView',
      venueId: ed.activeVenueId || '',
      eventId: activeEventId || '',
      sessionId: ed.selectedSessionId || '',
      lang,
    });
    window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank', 'noopener');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <div className="page-sub">{t.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={openFullscreenView} disabled={!ed.activeVenueId}>
            <Icon name="expand" size={14}/> {t.viewFullscreen}
          </button>
          <button className="btn" onClick={() => ed.setShowClearConfirm(true)}>
            <Icon name="trash" size={14}/> {t.clearAll}
          </button>
          <button className="btn primary" onClick={ed.saveLayout} disabled={ed.savingLayout}>
            <Icon name={ed.saved ? 'check' : 'download'} size={14}/> {ed.savingLayout ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : ed.saved ? t.saved : t.save}
          </button>
        </div>
      </div>

      <VenueToolbar
        venues={ed.venues}
        activeVenueId={ed.activeVenueId}
        onSwitchVenue={ed.switchVenue}
        sessions={ed.sessions}
        selectedSessionId={ed.selectedSessionId}
        onSessionChange={ed.setSelectedSessionId}
        activeVenue={ed.activeVenue}
        canDeleteVenue={ed.venues.length > 1}
        onDeleteVenueClick={() => ed.setPendingDeleteVenueId(ed.activeVenueId)}
        onAddVenueClick={() => ed.setShowAddVenue(true)}
        boxWidth={ed.boxWidth}
        boxHeight={ed.boxHeight}
        canvasSize={ed.canvasSize}
        onSetBoxSize={ed.setBoxSize}
        isAr={isAr}
        t={t}
      />

      <AddVenueModal
        open={ed.showAddVenue}
        onClose={() => ed.setShowAddVenue(false)}
        lang={lang}
        onSaved={ed.handleVenueCreated}
        activeEventId={activeEventId}
        selectedSessionId={ed.selectedSessionId}
      />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}><strong style={{ color: 'var(--ink)' }}>{ad(ed.tables.length)}</strong> {t.tables}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}><strong style={{ color: 'var(--ink)' }}>{ad(ed.totalSeats)}</strong> {t.totalSeats}</span>
      </div>

      <div className="venue-layout" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <ElementPalette
          elementTypes={ed.elementTypes}
          dragTypeRef={ed.dragTypeRef}
          isAr={isAr}
          title={t.palette}
          dragHint={t.dragHint}
          descByCode={descByCode}
        />

        <VenueCanvas
          tables={ed.tables}
          canvasW={ed.canvasSize.w}
          canvasH={ed.canvasSize.h}
          selectedId={ed.selectedId}
          selectedSeat={ed.selectedSeat}
          deleteSeatMode={ed.deleteSeatMode}
          zoom={ed.zoom}
          setZoom={ed.setZoom}
          zoomIn={ed.zoomIn}
          zoomOut={ed.zoomOut}
          zoomReset={ed.zoomReset}
          dragTypeRef={ed.dragTypeRef}
          onDrop={ed.addTable}
          onCanvasClick={ed.onCanvasClick}
          onElementMouseDown={ed.onElementMouseDown}
          onSeatClick={ed.onSeatClick}
          onDeleteSeat={ed.handleDeleteSeat}
          hasAnyLayout={ed.hasAnyLayout}
          applyingDefault={ed.applyingDefault}
          onApplyDefaultLayout={ed.applyDefaultLayout}
          onAddBlockClick={() => ed.setShowAddBlock(true)}
          isAr={isAr}
          emptyHint={isAr ? 'اسحب عنصراً من القائمة' : 'Drag an element from the palette'}
        />

        <ConfigPanel
          selectedTable={ed.selectedTable}
          selectedSeat={ed.selectedSeat}
          setSelectedSeat={ed.setSelectedSeat}
          deleteSeatMode={ed.deleteSeatMode}
          setDeleteSeatMode={ed.setDeleteSeatMode}
          updateTable={ed.updateTable}
          removeTable={ed.removeTable}
          restoreSeats={ed.restoreSeats}
          isAr={isAr}
          ad={ad}
          t={t}
        />
      </div>

      {/* Delete venue confirm */}
      <Modal
        open={!!ed.pendingDeleteVenueId}
        onClose={() => ed.setPendingDeleteVenueId(null)}
        title={t.deleteVenue}
        width={360}
        footer={
          <>
            <button className="btn" onClick={() => ed.setPendingDeleteVenueId(null)} disabled={ed.deletingVenue}>{t.cancel}</button>
            <button className="btn primary" style={{ background: 'rgba(224,138,126,0.2)', color: '#e08a7e', borderColor: 'rgba(224,138,126,0.3)' }}
              onClick={ed.confirmDeleteVenue} disabled={ed.deletingVenue}>
              {ed.deletingVenue ? (isAr ? 'جارٍ الحذف…' : 'Deleting…') : t.confirm}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
          <strong>{ed.venues.find(v => v.id === ed.pendingDeleteVenueId)?.name}</strong>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{t.deleteVenueMsg}</div>
      </Modal>

      {/* Clear-all confirm */}
      <Modal
        open={ed.showClearConfirm}
        onClose={() => ed.setShowClearConfirm(false)}
        title={t.clearMsg}
        width={360}
        footer={
          <>
            <button className="btn" onClick={() => ed.setShowClearConfirm(false)} disabled={ed.clearingLayout}>{t.cancel}</button>
            <button className="btn primary" style={{ background: 'rgba(224,138,126,0.2)', color: '#e08a7e', borderColor: 'rgba(224,138,126,0.3)' }}
              onClick={ed.clearLayout} disabled={ed.clearingLayout}>
              {ed.clearingLayout ? (isAr ? 'جارٍ الحذف…' : 'Clearing…') : t.confirm}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
          {isAr ? `سيتم حذف ${ad(ed.tables.length)} عنصر.` : `This will remove all ${ed.tables.length} elements from this venue.`}
        </div>
      </Modal>

      {/* Add block */}
      <Modal
        open={ed.showAddBlock}
        onClose={() => ed.setShowAddBlock(false)}
        title={t.addBlock}
        subtitle={t.addBlockMsg}
        width={380}
        footer={
          <>
            <button className="btn" onClick={() => ed.setShowAddBlock(false)} disabled={ed.addingBlock}>{t.cancel}</button>
            <button className="btn primary" onClick={submitAddBlock} disabled={ed.addingBlock || !blockForm.label.trim()}>
              {ed.addingBlock ? t.adding : t.add}
            </button>
          </>
        }
      >
        <div>
          <label style={blockLabelStyle}>{t.blockLabel}</label>
          <input style={blockInputStyle} value={blockForm.label}
            onChange={e => setBlockForm(f => ({ ...f, label: e.target.value }))}
            placeholder={isAr ? 'مثال: المدرج الشمالي' : 'e.g. North Stand'}/>
        </div>
        <div>
          <label style={blockLabelStyle}>{t.blockCategory}</label>
          <Select
            value={blockForm.category}
            onChange={v => setBlockForm(f => ({ ...f, category: v }))}
            options={blockCategoryOptions}
            placeholder={isAr ? '— اختر —' : '— Select —'}
            isClearable
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={blockLabelStyle}>{t.rows}</label>
            <input type="number" min={1} style={blockInputStyle} value={blockForm.rows}
              onChange={e => setBlockForm(f => ({ ...f, rows: e.target.value }))}/>
          </div>
          <div>
            <label style={blockLabelStyle}>{t.seatsPerRow}</label>
            <input type="number" min={1} style={blockInputStyle} value={blockForm.seatsPerRow}
              onChange={e => setBlockForm(f => ({ ...f, seatsPerRow: e.target.value }))}/>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const blockInputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};
const blockLabelStyle = {
  display: 'block', fontSize: 10.5, color: 'var(--ink-mute)',
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5,
};
