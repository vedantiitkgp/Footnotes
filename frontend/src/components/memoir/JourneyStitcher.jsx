import { useState, useEffect } from 'react';
import { getCoins, earnCoins } from '../../utils/coins.js';
import './JourneyStitcher.css';

const JOURNEY_TYPES = [
  { id: 'flight',    label: 'Flight',    icon: '/journey-plane.svg', abbr: 'FL' },
  { id: 'train',     label: 'Train',     icon: '/journey-train.svg', abbr: 'TR' },
  { id: 'road_trip', label: 'Road Trip', icon: '/journey-car.svg',   abbr: 'RD' },
];

const EXTRA_FIELDS = {
  flight: [
    { key: 'airline',   label: 'Airline',            placeholder: 'e.g. Emirates, IndiGo…' },
    { key: 'flightNo',  label: 'Flight No.',          placeholder: 'e.g. EK202' },
    { key: 'ffNumber',  label: 'Frequent Flyer No.',  placeholder: 'optional' },
    { key: 'cabin',     label: 'Cabin Class', type: 'select',
      options: ['Economy', 'Premium Economy', 'Business', 'First'] },
  ],
  train: [
    { key: 'operator',  label: 'Train Operator',      placeholder: 'e.g. Amtrak, Deutsche Bahn…' },
    { key: 'trainNo',   label: 'Train No.',            placeholder: 'e.g. 12302, TGV 6215' },
    { key: 'class',     label: 'Class', type: 'select',
      options: ['Standard', 'First Class', 'Sleeper', 'Executive'] },
    { key: 'seat',      label: 'Seat / Berth',         placeholder: 'e.g. Coach 3, Seat 42 — optional' },
  ],
  road_trip: [
    { key: 'vehicle',    label: 'Vehicle',             placeholder: 'e.g. Rented Corolla, My Jeep…' },
    { key: 'route',      label: 'Route / Highway',     placeholder: 'e.g. Route 66, NH-48 — optional' },
    { key: 'companions', label: 'Travel Companions',   placeholder: 'e.g. Sarah & Tim — optional' },
  ],
};

const STITCH_REWARD = 300;

function getStorageKey(sid) { return `memoir-journeys:${sid}`; }
function loadJourneys(sid) {
  try { return JSON.parse(localStorage.getItem(getStorageKey(sid)) || '[]'); } catch { return []; }
}
function saveJourneys(sid, journeys) {
  localStorage.setItem(getStorageKey(sid), JSON.stringify(journeys));
}
function emptyExtras(type) {
  return Object.fromEntries((EXTRA_FIELDS[type] || []).map((f) => [f.key, '']));
}
function extrasFromJourney(journey) {
  return { ...emptyExtras(journey.type), ...(journey.extras || {}) };
}

// Sort key: "YYYY-MM-DDThh:mm" or "9999" if no date (undated legs go to end)
function sortKey(j) {
  if (!j.departureDate) return '9999';
  return j.departureDate + 'T' + (j.departureTime || '00:00');
}

function formatDateTime(date, time) {
  if (!date) return null;
  const d = new Date(`${date}T${time || '00:00'}`);
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = time ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
  return timeStr ? `${dateStr}, ${timeStr}` : dateStr;
}

// ─── Ticket helpers ──────────────────────────────────────────────────────────
function readFileAsBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result); // data URL
    reader.readAsDataURL(file);
  });
}

// ─── Shared form ────────────────────────────────────────────────────────────
function JourneyForm({
  type, from, to, date, time, extras,
  ticket, ticketName,
  onTypeChange, onFromChange, onToChange, onDateChange, onTimeChange, onExtraChange,
  onTicketChange,
  onSubmit, onCancel, submitLabel,
}) {
  const extraFields = EXTRA_FIELDS[type] || [];
  return (
    <form className="stitcher__form" onSubmit={onSubmit}>
      {/* Transport type */}
      <div className="stitcher__section-label">Mode of transport</div>
      <div className="stitcher__type-row">
        {JOURNEY_TYPES.map((t) => (
          <button key={t.id} type="button"
            className={`stitcher__type-chip${type === t.id ? ' stitcher__type-chip--active' : ''}`}
            onClick={() => onTypeChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Route */}
      <div className="stitcher__section-label">Route</div>
      <div className="stitcher__inputs">
        <div className="stitcher__input-wrap">
          <label className="stitcher__label">Departed from</label>
          <input className="stitcher__input" type="text" placeholder="City, airport, station…"
            value={from} onChange={(e) => onFromChange(e.target.value)} required />
        </div>
        <div className="stitcher__arrow-mid">→</div>
        <div className="stitcher__input-wrap">
          <label className="stitcher__label">Arrived at</label>
          <input className="stitcher__input" type="text" placeholder="City, airport, station…"
            value={to} onChange={(e) => onToChange(e.target.value)} required />
        </div>
      </div>

      {/* Date & time */}
      <div className="stitcher__section-label">
        Departure date &amp; time <span className="stitcher__optional-hint">— optional</span>
      </div>
      <div className="stitcher__datetime-row">
        <div className="stitcher__input-wrap">
          <label className="stitcher__label">Date</label>
          <input className="stitcher__input stitcher__input--date" type="date"
            value={date} onChange={(e) => onDateChange(e.target.value)} />
        </div>
        <div className="stitcher__input-wrap">
          <label className="stitcher__label">Time</label>
          <input className="stitcher__input stitcher__input--time" type="time"
            value={time} onChange={(e) => onTimeChange(e.target.value)} />
        </div>
      </div>

      {/* Type-specific extras */}
      {extraFields.length > 0 && (
        <>
          <div className="stitcher__section-label">
            Details <span className="stitcher__optional-hint">— all optional</span>
          </div>
          <div className="stitcher__extras-grid">
            {extraFields.map((f) =>
              f.type === 'select' ? (
                <div key={f.key} className="stitcher__input-wrap">
                  <label className="stitcher__label">{f.label}</label>
                  <select className="stitcher__input stitcher__select"
                    value={extras[f.key] || ''} onChange={(e) => onExtraChange(f.key, e.target.value)}>
                    <option value="">— select —</option>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ) : (
                <div key={f.key} className="stitcher__input-wrap">
                  <label className="stitcher__label">{f.label}</label>
                  <input className="stitcher__input" type="text" placeholder={f.placeholder}
                    value={extras[f.key] || ''} onChange={(e) => onExtraChange(f.key, e.target.value)} />
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* Ticket upload */}
      <div className="stitcher__section-label">
        Ticket <span className="stitcher__optional-hint">— PDF or image, optional</span>
      </div>
      {ticket ? (
        <div className="stitcher__ticket-attached">
          <span className="stitcher__ticket-filename">{ticketName}</span>
          <button type="button" className="stitcher__ticket-remove" onClick={() => onTicketChange(null, null)}>Remove</button>
        </div>
      ) : (
        <label className="stitcher__ticket-upload">
          <input
            type="file"
            accept="application/pdf,image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const data = await readFileAsBase64(file);
              onTicketChange(data, file.name);
              e.target.value = '';
            }}
          />
          + Attach ticket
        </label>
      )}

      <div className="stitcher__form-footer">
        <button type="button" className="stitcher__cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="stitcher__submit">{submitLabel}</button>
      </div>
    </form>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function JourneyStitcher({ sessionId }) {
  const [coins, setCoins]       = useState(getCoins);
  const [journeys, setJourneys] = useState(() => loadJourneys(sessionId));
  const [flash, setFlash]       = useState(null);

  // ── Add form ──
  const [showForm, setShowForm]   = useState(false);
  const [type, setType]           = useState('flight');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [date, setDate]           = useState('');
  const [time, setTime]           = useState('');
  const [extras, setExtras]       = useState(() => emptyExtras('flight'));
  const [ticket, setTicket]       = useState(null);
  const [ticketName, setTicketName] = useState('');

  // ── Edit state ──
  const [editingId, setEditingId]         = useState(null);
  const [editType, setEditType]           = useState('flight');
  const [editFrom, setEditFrom]           = useState('');
  const [editTo, setEditTo]               = useState('');
  const [editDate, setEditDate]           = useState('');
  const [editTime, setEditTime]           = useState('');
  const [editExtras, setEditExtras]       = useState({});
  const [editTicket, setEditTicket]       = useState(null);
  const [editTicketName, setEditTicketName] = useState('');

  // ── Ticket viewer modal ──
  const [viewingTicket, setViewingTicket] = useState(null); // { data, name }

  useEffect(() => { saveJourneys(sessionId, journeys); }, [journeys, sessionId]);

  // ── Add handlers ──
  function handleTypeChange(t) { setType(t); setExtras(emptyExtras(t)); }
  function setExtra(k, v) { setExtras((p) => ({ ...p, [k]: v })); }

  function handleStitch(e) {
    e.preventDefault();
    const f = from.trim(), t = to.trim();
    if (!f || !t) return;
    earnCoins(STITCH_REWARD);
    setCoins(getCoins());
    const filledExtras = Object.fromEntries(Object.entries(extras).filter(([, v]) => v.trim()));
    setJourneys((prev) =>
      [...prev, { id: Date.now(), type, from: f, to: t, departureDate: date, departureTime: time, extras: filledExtras, ticket, ticketName, createdAt: new Date().toISOString() }]
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    );
    setFrom(''); setTo(''); setDate(''); setTime(''); setExtras(emptyExtras(type));
    setTicket(null); setTicketName('');
    setShowForm(false);
    setFlash('success');
    setTimeout(() => setFlash(null), 2800);
  }

  // ── Edit handlers ──
  function startEdit(journey) {
    setShowForm(false);
    setEditingId(journey.id);
    setEditType(journey.type);
    setEditFrom(journey.from);
    setEditTo(journey.to);
    setEditDate(journey.departureDate || '');
    setEditTime(journey.departureTime || '');
    setEditExtras(extrasFromJourney(journey));
    setEditTicket(journey.ticket || null);
    setEditTicketName(journey.ticketName || '');
  }

  function handleEditTypeChange(t) {
    setEditType(t);
    setEditExtras((prev) => ({ ...emptyExtras(t), ...prev }));
  }

  function setEditExtra(k, v) { setEditExtras((p) => ({ ...p, [k]: v })); }

  function handleSave(e) {
    e.preventDefault();
    const f = editFrom.trim(), t = editTo.trim();
    if (!f || !t) return;
    const filledExtras = Object.fromEntries(Object.entries(editExtras).filter(([, v]) => v.trim()));
    setJourneys((prev) =>
      prev.map((j) =>
        j.id === editingId
          ? { ...j, type: editType, from: f, to: t, departureDate: editDate, departureTime: editTime, extras: filledExtras, ticket: editTicket, ticketName: editTicketName }
          : j
      ).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    );
    setEditingId(null);
  }

  function cancelEdit() { setEditingId(null); }
  function handleRemove(id) { setJourneys((prev) => prev.filter((j) => j.id !== id)); }

  // Sorted for display (already sorted on mutation, but ensure on load too)
  const sortedJourneys = [...journeys].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  return (
    <div className="stitcher">
      {/* Header */}
      <div className="stitcher__header">
        <div>
          <h2 className="stitcher__title">Journeys</h2>
          <p className="stitcher__subtitle">Log every leg — earn 300 coins per journey, 500 per memoir</p>
        </div>
        <div className="stitcher__coins">
          <span className="stitcher__coins-icon">✦</span>
          <span className="stitcher__coins-amount">{coins.toLocaleString()}</span>
          <span className="stitcher__coins-label">coins</span>
        </div>
      </div>

      {/* Vehicle strip */}
      <div className="stitcher__vehicles">
        {JOURNEY_TYPES.map((t) => (
          <div key={t.id} className="stitcher__vehicle-item">
            <img src={t.icon} alt={t.label} className="stitcher__vehicle-img" />
            <span className="stitcher__vehicle-label">{t.label}</span>
          </div>
        ))}
      </div>

      {/* Flash */}
      {flash === 'success' && (
        <div className="stitcher__flash stitcher__flash--success">
          ✦ Journey stitched — +{STITCH_REWARD} coins earned!
        </div>
      )}

      {/* Timeline */}
      {sortedJourneys.length > 0 && (
        <ol className="stitcher__timeline">
          {sortedJourneys.map((j, i) => {
            const t = JOURNEY_TYPES.find((x) => x.id === j.type);
            const isEditing = editingId === j.id;
            const datetime  = formatDateTime(j.departureDate, j.departureTime);

            return (
              <li key={j.id} className={`stitcher__leg${isEditing ? ' stitcher__leg--editing' : ''}`}>
                <div className="stitcher__leg-dot">
                  {(isEditing ? JOURNEY_TYPES.find((x) => x.id === editType) : t)?.abbr}
                </div>
                {i < sortedJourneys.length - 1 && <div className="stitcher__leg-line" />}

                <div className="stitcher__leg-body">
                  {isEditing ? (
                    <JourneyForm
                      type={editType} from={editFrom} to={editTo} date={editDate} time={editTime} extras={editExtras}
                      ticket={editTicket} ticketName={editTicketName}
                      onTypeChange={handleEditTypeChange}
                      onFromChange={setEditFrom} onToChange={setEditTo}
                      onDateChange={setEditDate} onTimeChange={setEditTime}
                      onExtraChange={setEditExtra}
                      onTicketChange={(data, name) => { setEditTicket(data); setEditTicketName(name || ''); }}
                      onSubmit={handleSave} onCancel={cancelEdit}
                      submitLabel="Save changes"
                    />
                  ) : (
                    <>
                      {datetime && (
                        <div className="stitcher__leg-datetime">{datetime}</div>
                      )}
                      <div className="stitcher__leg-route">
                        <span className="stitcher__leg-from">{j.from}</span>
                        <span className="stitcher__leg-arrow">→</span>
                        <span className="stitcher__leg-to">{j.to}</span>
                        <span className="stitcher__leg-type">{t?.label}</span>
                        <div className="stitcher__leg-actions">
                          <button className="stitcher__leg-edit" onClick={() => startEdit(j)} title="Edit">Edit</button>
                          <button className="stitcher__leg-remove" onClick={() => handleRemove(j.id)} title="Remove">×</button>
                        </div>
                      </div>
                      {Object.entries(j.extras || {}).length > 0 && (
                        <div className="stitcher__leg-extras">
                          {Object.entries(j.extras).map(([k, v]) => {
                            const field = (EXTRA_FIELDS[j.type] || []).find((f) => f.key === k);
                            return (
                              <span key={k} className="stitcher__leg-extra-pill">
                                <span className="stitcher__leg-extra-key">{field?.label || k}</span>
                                {v}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {j.ticket && (
                        <button
                          className="stitcher__leg-ticket-btn"
                          onClick={() => setViewingTicket({ data: j.ticket, name: j.ticketName })}
                        >
                          View ticket
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Add form / button */}
      {editingId === null && (
        !showForm ? (
          <button className="stitcher__add-btn" onClick={() => setShowForm(true)}>
            + Stitch a journey leg
            <span className="stitcher__add-cost">+{STITCH_REWARD} coins</span>
          </button>
        ) : (
          <JourneyForm
            type={type} from={from} to={to} date={date} time={time} extras={extras}
            ticket={ticket} ticketName={ticketName}
            onTypeChange={handleTypeChange}
            onFromChange={setFrom} onToChange={setTo}
            onDateChange={setDate} onTimeChange={setTime}
            onExtraChange={setExtra}
            onTicketChange={(data, name) => { setTicket(data); setTicketName(name || ''); }}
            onSubmit={handleStitch} onCancel={() => setShowForm(false)}
            submitLabel={`Stitch — earn +${STITCH_REWARD} coins`}
          />
        )
      )}
      {/* Ticket viewer modal */}
      {viewingTicket && (
        <div className="stitcher__ticket-modal" onClick={() => setViewingTicket(null)}>
          <div className="stitcher__ticket-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="stitcher__ticket-modal-header">
              <span className="stitcher__ticket-modal-name">{viewingTicket.name}</span>
              <button className="stitcher__ticket-modal-close" onClick={() => setViewingTicket(null)}>✕</button>
            </div>
            {viewingTicket.data.startsWith('data:application/pdf') ? (
              <iframe
                className="stitcher__ticket-iframe"
                src={viewingTicket.data}
                title={viewingTicket.name}
              />
            ) : (
              <img
                className="stitcher__ticket-img"
                src={viewingTicket.data}
                alt={viewingTicket.name}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
