import { Icon } from "../../../../components/Icons";

// STEP 4 — Invitation. Moved verbatim out of GuestModal.jsx's inline JSX.
export default function GuestModalStep4Invitation({
  form,
  templateId,
  setTemplateId,
  templates,
  isAr,
  t,
}) {
  return (
    <div>
      <div className="guest-modal-row-header">
        <label className="guest-modal-field-label" style={{ margin: 0 }}>
          {t.step4.templateOptional}
        </label>
        <span className="guest-modal-hint-text">
          {t.step4.manageTemplatesHint}
        </span>
      </div>
      {!form.email && (
        <div className="guest-modal-noemail-warning">
          {t.step4.noEmailWarning}
        </div>
      )}
      <div className="guest-modal-template-list">
        <div
          onClick={() => setTemplateId(null)}
          className={
            "guest-modal-template-item guest-modal-template-item--noinv" +
            (!templateId ? " selected" : "")
          }
        >
          <div
            className={
              "guest-modal-template-radio" + (!templateId ? " selected" : "")
            }
          >
            {!templateId && (
              <Icon name="check" size={10} style={{ color: "#fff" }} />
            )}
          </div>
          <div>
            <div className="guest-modal-template-name">
              {t.step4.noInvitation}
            </div>
            <div className="guest-modal-template-desc">
              {t.step4.noInvitationDesc}
            </div>
          </div>
        </div>
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            onClick={() => setTemplateId(tmpl.id)}
            className={
              "guest-modal-template-item" +
              (templateId === tmpl.id ? " selected" : "")
            }
            style={{
              border: `1px solid ${templateId === tmpl.id ? tmpl.color || "var(--accent)" : "var(--glass-border)"}`,
              background:
                templateId === tmpl.id
                  ? (tmpl.color || "var(--accent)") + "18"
                  : "var(--surface-soft-2)",
            }}
          >
            <div className="guest-modal-template-row">
              <span
                className="guest-modal-template-dot"
                style={{ background: tmpl.color || "var(--accent)" }}
              />
              <span className="guest-modal-template-name">
                {isAr ? tmpl.nameAr || tmpl.name : tmpl.name}
              </span>
              <span className="guest-modal-template-lang">
                {tmpl.language}
              </span>
            </div>
            <div className="guest-modal-template-subject">
              {isAr ? tmpl.subjectAr || tmpl.subject : tmpl.subject}
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="guest-modal-empty-templates">
            {t.step4.noTemplates}
          </div>
        )}
      </div>
    </div>
  );
}
