import React from "react";
import { Icon } from "../../../../components/Icons";

// Every step carries its label all the time, and the connecting bars flex to
// fill the row — one continuous progress bar spanning the full modal width,
// not a cluster of dots. Moved verbatim out of GuestModal.jsx's inline JSX.
export default function GuestModalProgress({ stepLabels, activeSteps, step, stepPos }) {
  return (
    <div className="wizard-steps" role="group" aria-label="Progress">
      {stepLabels.map((label, i) => {
        const s = activeSteps[i];
        const done = stepPos > i;
        const active = step === s;
        return (
          <React.Fragment key={i}>
            <div
              className={`wizard-step${active ? " active" : ""}${done ? " done" : ""}`}
              aria-current={active ? "step" : undefined}
            >
              <span className="wizard-dot">
                {done ? <Icon name="check" size={11} /> : s}
              </span>
              <span className="wizard-label" title={label}>
                {label}
              </span>
            </div>
            {i < stepLabels.length - 1 && (
              <span className={`wizard-bar${done ? " done" : ""}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
