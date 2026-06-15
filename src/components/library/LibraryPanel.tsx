"use client";

import { useRef, useState } from "react";
import { PageHeader } from "../ui";
import CompetencyEditor from "./CompetencyEditor";
import CompetencyImport from "./CompetencyImport";
import ItemEditor from "./ItemEditor";
import ItemImport from "./ItemImport";
import JobRoleEditor from "./JobRoleEditor";
import OrgUnitEditor from "./OrgUnitEditor";
import ScaleEditor from "./ScaleEditor";
import TrainingEditor from "./TrainingEditor";
import TrainingImport from "./TrainingImport";

const TABS = [
  { key: "competencies", label: "Competencies" },
  { key: "scales", label: "Scales" },
  { key: "roles", label: "Job roles & targets" },
  { key: "training", label: "Training catalog" },
  { key: "items", label: "Assessment items" },
  { key: "org_units", label: "Org units" },
  { key: "import", label: "Import" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function LibraryPanel() {
  const [active, setActive] = useState<TabKey>("competencies");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onTabKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    setActive(TABS[next].key);
    tabRefs.current[next]?.focus();
  }

  return (
    <>
      <PageHeader
        title="Content Library"
        subtitle="Author the competencies, scales, role targets, training, and assessment items the analysis runs on. Edits apply to new development cycles — they don't disturb assessments already in progress."
      />

      <div role="tablist" aria-label="Library sections" className="mb-6 flex flex-wrap gap-x-1 gap-y-1 border-b border-line">
        {TABS.map((t, i) => {
          const selected = active === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`lib-tab-${t.key}`}
              data-testid={`lib-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`lib-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.key)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`-mb-px min-h-11 rounded-t-lg border-b-2 px-3.5 text-sm font-medium transition ${
                selected ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`lib-panel-${active}`} aria-labelledby={`lib-tab-${active}`} className="rise">
        {active === "competencies" && <CompetencyEditor />}
        {active === "scales" && <ScaleEditor />}
        {active === "roles" && <JobRoleEditor />}
        {active === "training" && <TrainingEditor />}
        {active === "items" && <ItemEditor />}
        {active === "org_units" && <OrgUnitEditor />}
        {active === "import" && (
          <div className="space-y-8">
            <p className="text-sm text-muted">Bulk-load the framework from CSV. Import competencies first, then assessment items, then training — each step references the one before it.</p>
            <CompetencyImport />
            <ItemImport />
            <TrainingImport />
          </div>
        )}
      </div>
    </>
  );
}
