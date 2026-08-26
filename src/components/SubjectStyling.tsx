"use client";

import {
  DETAIL_CATEGORIES,
  detailOptionsFor,
  ETHNICITIES,
  resolveDetail,
  SUBJECT_AGES,
  SUBJECT_GENDERS,
  type SubjectAgeId,
  type SubjectGenderId,
} from "@/lib/options";
import { useStudio } from "./studio-store";
import { Field, Select } from "./ui";
import { Panel } from "./steps/shared";

/**
 * Who is in the shot, and what they're wearing.
 *
 * Split into two exports because they belong in different places: the identity
 * fields sit inside whatever panel already describes the scene, while the
 * styling details earn a panel of their own.
 *
 * Both render nothing when the shot has no people in it — controls that steer
 * nobody are just a way to make the model invent someone.
 */

export function SubjectFields() {
  const s = useStudio();
  const { base } = s;
  if (base.presenceId === "none") return null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary subject" help="styling.subject">
          <Select
            value={base.genderId}
            onChange={(genderId) => s.setBase({ genderId: genderId as SubjectGenderId })}
            options={SUBJECT_GENDERS.map((g) => ({
              id: g.id,
              label: g.label,
              emoji: g.emoji,
              hint: g.hint,
            }))}
          />
        </Field>
        <Field label="Age" help="styling.age">
          <Select
            value={base.ageId}
            onChange={(ageId) => s.setBase({ ageId: ageId as SubjectAgeId })}
            options={SUBJECT_AGES.map((a) => ({ id: a.id, label: a.label, emoji: a.emoji }))}
          />
        </Field>
      </div>

      <Field
        label="Ethnicity"
        help="styling.ethnicity"
        hint="No faces are ever shown, so this carries through skin tone, hands and hair."
      >
        <Select
          value={base.ethnicityId}
          onChange={(ethnicityId) => s.setBase({ ethnicityId })}
          options={ETHNICITIES.map((e) => ({
            id: e.id,
            label: e.label,
            emoji: e.emoji,
            hint: e.hint,
          }))}
        />
      </Field>
    </>
  );
}

export function DetailsPanel() {
  const s = useStudio();
  const { base } = s;
  if (base.presenceId === "none") return null;

  const gender = base.genderId;
  const age = base.ageId;

  const chosen = DETAIL_CATEGORIES.filter(
    (c) => resolveDetail(c, base.details, gender, age) !== "unspecified",
  ).length;

  return (
    <Panel
      title="Styling details"
      help="styling.details"
      aside={
        <span className="sticker">{chosen ? `${chosen} set` : "All optional"}</span>
      }
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-ink-faint">
          The small stuff that makes a shot look art-directed. Everything here is on the hands,
          wrists and forearms, because that&apos;s the part of a person these frames actually
          show — right next to the card.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {DETAIL_CATEGORIES.map((category) => {
            // Options are filtered by subject, and the stored pick is re-checked
            // against that filter — changing the subject silently drops a detail
            // that no longer fits rather than leaving it applied.
            const options = detailOptionsFor(category, gender, age);
            const value = resolveDetail(category, base.details, gender, age);

            return (
              <Field key={category.id} label={category.label} help={`styling.detail.${category.id}`} hint={category.hint}>
                <Select
                  value={value}
                  onChange={(id) =>
                    s.setBase({
                      details:
                        id === "unspecified"
                          ? Object.fromEntries(
                              Object.entries(base.details).filter(([k]) => k !== category.id),
                            )
                          : { ...base.details, [category.id]: id },
                    })
                  }
                  options={options.map((o) => ({
                    id: o.id,
                    label: o.label,
                    emoji: o.id === "unspecified" ? category.emoji : undefined,
                    hint: o.hint,
                  }))}
                />
              </Field>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
