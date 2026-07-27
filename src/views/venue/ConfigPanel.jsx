import React from 'react';
import { Icon } from '../../components/Icons.jsx';
import { SWATCH_COLORS, tableHasSeats, seatCodeForIndex } from './venueHelpers.js';

const sliderStyle = { width: '100%', accentColor: 'var(--accent)' };
const inputStyle = { width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '8px 11px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 };

export default function ConfigPanel({
  selectedTable, selectedSeat, setSelectedSeat,
  deleteSeatMode, setDeleteSeatMode,
  updateTable, removeTable, restoreSeats,
  isAr, ad, t,
}) {
  const hasSeats = tableHasSeats(selectedTable);

  return (
    <div className="venue-config-panel" style={{ width: 224, flexShrink: 0 }}>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--glass-border)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600 }}>
          {t.configure}
        </div>
        {!selectedTable ? (
          <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12 }}>
            {t.noSelection}
          </div>
        ) : (
          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
            <div>
              <label style={labelStyle}>{t.label}</label>
              <input style={inputStyle} value={selectedTable.label}
                onChange={e => updateTable(selectedTable.id, { label: e.target.value })}/>
            </div>

            <div>
              <label style={labelStyle}>{t.rotation}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="range" min={0} max={359} value={selectedTable.rotation || 0} style={{ ...sliderStyle, flex: 1 }}
                  onChange={e => updateTable(selectedTable.id, { rotation: +e.target.value })}/>
                <input type="number" min={0} max={359} value={selectedTable.rotation || 0}
                  style={{ ...inputStyle, width: 58, padding: '5px 6px', textAlign: 'center', flexShrink: 0 }}
                  onChange={e => {
                    const raw = +e.target.value;
                    if (Number.isNaN(raw)) return;
                    updateTable(selectedTable.id, { rotation: ((raw % 360) + 360) % 360 });
                  }}/>
                <span style={{ fontSize: 12, color: 'var(--ink-mute)', flexShrink: 0 }}>°</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}><span>0°</span><span>359°</span></div>
            </div>

            <div>
              <label style={labelStyle}>{t.color}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SWATCH_COLORS.map(sw => (
                  <button key={sw} onClick={() => updateTable(selectedTable.id, { color: sw })}
                    style={{
                      width: 20, height: 20, borderRadius: '50%', background: sw, padding: 0, cursor: 'pointer',
                      border: selectedTable.color === sw ? '2.5px solid rgba(255,255,255,0.85)' : '2px solid transparent',
                      boxShadow: selectedTable.color === sw ? '0 0 0 2px var(--accent)' : 'none',
                      outline: 'none',
                    }}/>
                ))}
                {selectedTable.color && (
                  <button className="btn" style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={() => updateTable(selectedTable.id, { color: null })}>
                    {isAr ? 'بلا لون' : 'Clear'}
                  </button>
                )}
              </div>
            </div>

            {selectedTable.type === 'round' && (
              <div>
                <label style={labelStyle}>{t.seats} · {ad(selectedTable.seats)}</label>
                <input type="range" min={4} max={20} value={selectedTable.seats} style={sliderStyle}
                  onChange={e => updateTable(selectedTable.id, { seats: +e.target.value })}/>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}><span>4</span><span>20</span></div>
              </div>
            )}

            {selectedTable.type === 'rect' && (
              <div>
                <label style={labelStyle}>{t.seatsPerSide} · {ad(selectedTable.seatsPerSide)}</label>
                <input type="range" min={2} max={8} value={selectedTable.seatsPerSide} style={sliderStyle}
                  onChange={e => updateTable(selectedTable.id, { seatsPerSide: +e.target.value })}/>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}><span>2</span><span>8</span></div>
              </div>
            )}

            {selectedTable.type === 'stadium' && (
              <>
                <div>
                  <label style={labelStyle}>{t.rows} · {ad(selectedTable.rows)}</label>
                  <input type="range" min={2} max={10} value={selectedTable.rows} style={sliderStyle}
                    onChange={e => {
                      const newRows = +e.target.value;
                      updateTable(selectedTable.id, { rows: newRows });
                      if (selectedSeat && selectedSeat.tableId === selectedTable.id && Math.floor(selectedSeat.index / selectedTable.seatsPerRow) >= newRows)
                        setSelectedSeat(null);
                    }}/>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}><span>2</span><span>10</span></div>
                </div>
                <div>
                  <label style={labelStyle}>{t.seatsPerRow} · {ad(selectedTable.seatsPerRow)}</label>
                  <input type="range" min={5} max={20} value={selectedTable.seatsPerRow} style={sliderStyle}
                    onChange={e => {
                      const newSpr = +e.target.value;
                      updateTable(selectedTable.id, { seatsPerRow: newSpr });
                      if (selectedSeat && selectedSeat.tableId === selectedTable.id && (selectedSeat.index % selectedTable.seatsPerRow) >= newSpr)
                        setSelectedSeat(null);
                    }}/>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}><span>5</span><span>20</span></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', background: 'var(--surface-soft-2)', borderRadius: 6, padding: '6px 10px' }}>
                  {ad(selectedTable.rows * selectedTable.seatsPerRow)} {isAr ? 'مقعد' : 'seats total'}
                </div>
              </>
            )}

            {selectedTable.type === 'stage' && (
              <>
                <div>
                  <label style={labelStyle}>{t.stageWidth} · {ad(selectedTable.stageW || 220)}px</label>
                  <input type="range" min={100} max={400} value={selectedTable.stageW || 220} style={sliderStyle}
                    onChange={e => updateTable(selectedTable.id, { stageW: +e.target.value })}/>
                </div>
                <div>
                  <label style={labelStyle}>{t.stageDepth} · {ad(selectedTable.stageH || 80)}px</label>
                  <input type="range" min={40} max={160} value={selectedTable.stageH || 80} style={sliderStyle}
                    onChange={e => updateTable(selectedTable.id, { stageH: +e.target.value })}/>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(224,184,100,0.85)', background: 'rgba(224,184,100,0.08)', borderRadius: 6, padding: '6px 10px' }}>
                  {t.noStageSeats}
                </div>
              </>
            )}

            {/* Pitch + any custom/future non-seat type (e.g. a manager-defined
                "Podium" lookup item) share the same generic area sizing. */}
            {!['round', 'rect', 'stadium', 'stage'].includes(selectedTable.type) && (
              <>
                <div>
                  <label style={labelStyle}>{t.areaWidth} · {ad(selectedTable.pitchW || 280)}px</label>
                  <input type="range" min={120} max={500} value={selectedTable.pitchW || 280} style={sliderStyle}
                    onChange={e => updateTable(selectedTable.id, { pitchW: +e.target.value })}/>
                </div>
                <div>
                  <label style={labelStyle}>{t.areaHeight} · {ad(selectedTable.pitchH || 140)}px</label>
                  <input type="range" min={80} max={300} value={selectedTable.pitchH || 140} style={sliderStyle}
                    onChange={e => updateTable(selectedTable.id, { pitchH: +e.target.value })}/>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(90,191,110,0.85)', background: 'rgba(90,191,110,0.08)', borderRadius: 6, padding: '6px 10px' }}>
                  {t.noPitchSeats}
                </div>
              </>
            )}

            {/* Selected seat editor — works for any seat-bearing type (round/rect/stadium) */}
            {hasSeats && selectedSeat && selectedSeat.tableId === selectedTable.id && (() => {
              const { index } = selectedSeat;
              const code = seatCodeForIndex(selectedTable, index);
              const seatNums = selectedTable.seatNumbers || {};
              const override = seatNums[index] !== undefined ? seatNums[index] : '';
              const meta = (selectedTable.seatMeta || {})[index] || {};
              const isDisabled = !!meta.isDisabled;

              function patchSeatMeta(patch) {
                const current = (selectedTable.seatMeta || {})[index] || {};
                const next = { ...current, ...patch };
                const seatMeta = { ...(selectedTable.seatMeta || {}) };
                // Drop the entry entirely once it's back to defaults, to keep payloads clean.
                if (!next.isDisabled && !next.seatInfo && !next.color) delete seatMeta[index];
                else seatMeta[index] = next;
                updateTable(selectedTable.id, { seatMeta });
              }

              return (
                <div style={{ padding: '10px', background: 'rgba(141, 1, 52,0.07)', border: '1px solid rgba(141, 1, 52,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginBottom: 8 }}>
                    {t.selectedSeat}:{' '}
                    <strong style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{code}</strong>
                    {isDisabled && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#e05555', fontWeight: 600 }}>
                        · {isAr ? 'معطّل' : 'Disabled'}
                      </span>
                    )}
                  </div>

                  <label style={labelStyle}>{t.seatNumber}</label>
                  <input style={inputStyle} value={override} placeholder={code}
                    onChange={e => {
                      const nums = { ...(selectedTable.seatNumbers || {}), [index]: e.target.value };
                      updateTable(selectedTable.id, { seatNumbers: nums });
                    }}/>

                  <label style={{ ...labelStyle, marginTop: 10 }}>{t.seatInfo}</label>
                  <input style={inputStyle} value={meta.seatInfo || ''}
                    placeholder={isAr ? 'اختياري — مثال: كرسي متحرك' : 'Optional — e.g. wheelchair access'}
                    onChange={e => patchSeatMeta({ seatInfo: e.target.value })}/>

                  <label style={{ ...labelStyle, marginTop: 10 }}>{t.seatColor}</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {SWATCH_COLORS.map(sw => (
                      <button key={sw} onClick={() => patchSeatMeta({ color: sw })}
                        style={{
                          width: 18, height: 18, borderRadius: '50%', background: sw, padding: 0, cursor: 'pointer',
                          border: meta.color === sw ? '2.5px solid rgba(255,255,255,0.85)' : '2px solid transparent',
                          boxShadow: meta.color === sw ? '0 0 0 2px var(--accent)' : 'none',
                          outline: 'none',
                        }}/>
                    ))}
                    {meta.color && (
                      <button className="btn" style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => patchSeatMeta({ color: null })}>
                        {isAr ? 'بلا لون' : 'Clear'}
                      </button>
                    )}
                  </div>

                  <button className="btn" style={{ marginTop: 10, width: '100%', justifyContent: 'center',
                      ...(isDisabled ? { background: 'rgba(220,70,70,0.1)', color: '#e05555', borderColor: 'rgba(220,70,70,0.3)' } : {}) }}
                    onClick={() => patchSeatMeta({ isDisabled: !isDisabled })}>
                    <Icon name={isDisabled ? 'check' : 'close'} size={12}/>
                    {isDisabled ? t.enableSeat : t.disableSeat}
                  </button>

                  <button className="btn" style={{ marginTop: 6, width: '100%', justifyContent: 'center', fontSize: 11 }}
                    onClick={() => setSelectedSeat(null)}>
                    {t.deselectSeat}
                  </button>
                </div>
              );
            })()}

            {/* {hasSeats && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ height: 1, background: 'var(--glass-border)' }}/>
                <button className="btn" style={{ width: '100%', justifyContent: 'center', ...(deleteSeatMode ? { background: 'rgba(220,70,70,0.1)', color: '#e05555', borderColor: 'rgba(220,70,70,0.3)' } : {}) }}
                  onClick={() => setDeleteSeatMode(d => !d)}>
                  <Icon name="trash" size={13}/> {deleteSeatMode ? t.exitDeleteMode : t.deleteSeats}
                </button>
                {(selectedTable.removedSeats?.length > 0) && (
                  <button className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }} onClick={restoreSeats}>
                    {isAr ? `استعادة ${ad(selectedTable.removedSeats.length)} مقعد` : `Restore ${selectedTable.removedSeats.length} seat(s)`}
                  </button>
                )}
                {deleteSeatMode && (
                  <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', textAlign: 'center', lineHeight: 1.4 }}>
                    {t.deleteSeatsHint}
                  </div>
                )}
              </div>
            )} */}

            <button className="btn" style={{ width: '100%', justifyContent: 'center', color: '#e08a7e', borderColor: 'rgba(224,138,126,0.3)' }}
              onClick={() => removeTable(selectedTable.id)}>
              <Icon name="trash" size={13}/> {t.deleteTable}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
