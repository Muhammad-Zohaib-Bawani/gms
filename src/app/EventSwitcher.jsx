import React, { useState, useEffect } from "react";
import { SHELL_I18N } from "./shellI18n";

// Moved verbatim out of App.jsx.
export default function EventSwitcher({ events = [], value, onChange, lang, theme }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  const shell = SHELL_I18N[lang] || SHELL_I18N.en;
  const ev = events.find((e) => e.key === value) || events[0] || null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Falls back to the event's cover image when no logo is set — it's a photo,
  // not a transparent mark, so it gets cover-cropped instead of letterboxed.
  const logoOf = (e) =>
    theme === "dark" ? e.logoDark || e.logoLight : e.logoLight || e.logoDark;
  const markOf = (e) => {
    const logo = logoOf(e);
    return logo
      ? { src: logo, cover: false }
      : e.image
        ? { src: e.image, cover: true }
        : null;
  };
  const LetterMark = ({ e, size }) => (
    <span
      style={{
        fontFamily: "var(--serif)",
        fontSize: size,
        fontStyle: "italic",
        color: e.accent,
      }}
    >
      {(e.title || "E").trim()[0]}
    </span>
  );

  if (!ev) {
    return (
      <div className="event-switcher" ref={ref}>
        <button className="event-trigger" disabled>
          <span className="event-text">
            <span className="event-name">{shell.switchEvent}</span>
            <span className="event-sub">—</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="event-switcher" ref={ref}>
      <button
        className={"event-trigger" + (open ? " open" : "")}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="event-logo-mark"
          data-event={ev.key}
          style={{
            background: `${ev.accent}22`,
            borderColor: `${ev.accent}50`,
          }}
        >
          {markOf(ev) ? (
            <img
              className={markOf(ev).cover ? "event-cover" : ""}
              src={markOf(ev).src}
              alt=""
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <LetterMark e={ev} size={16} />
          )}
        </span>
        <span className="event-text">
          <span className="event-name">{ev.title}</span>
          <span className="event-sub">{ev.subtitle}</span>
        </span>
        <svg
          className="event-caret"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M3 4.5L6 8 9 4.5" />
        </svg>
      </button>
      {open && (
        <div className="event-menu glass">
          <div className="event-menu-head">{shell.switchEvent}</div>
          {events.map((e) => {
            const isActive = e.key === value;
            const mark = markOf(e);
            return (
              <button
                key={e.key}
                className={"event-row" + (isActive ? " active" : "")}
                style={{
                  borderLeft: `3px solid ${e.accent}`,
                  background: isActive
                    ? "rgba(0, 98, 123, 0.10)"
                    : "transparent",
                }}
                onClick={() => {
                  onChange(e);
                  setOpen(false);
                }}
              >
                <span
                  className="event-logo-mark"
                  data-event={e.key}
                  style={{
                    background: `${e.accent}22`,
                    borderColor: `${e.accent}50`,
                    overflow: "hidden",
                  }}
                >
                  {mark ? (
                    <img
                      className={mark.cover ? "event-cover" : ""}
                      src={mark.src}
                      alt=""
                      onError={(err) => {
                        err.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <LetterMark e={e} size={15} />
                  )}
                </span>
                <span className="event-text">
                  <span
                    className="event-name"
                    style={{ color: isActive ? e.accent : undefined }}
                  >
                    {e.title}
                  </span>
                  <span className="event-sub">{e.subtitle}</span>
                </span>
                {isActive && (
                  <span className="event-check" style={{ color: e.accent }}>
                    <svg
                      viewBox="0 0 14 14"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M3 7.5l3 3 5-6.5" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
