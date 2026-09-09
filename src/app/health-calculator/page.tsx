"use client";

import { useState, type FormEvent } from "react";
import { Button, FormField, Input, ErrorBanner } from "@/components/ui";
import {
  calculate,
  ACTIVITY_LABELS,
  type ActivityLevel,
  type Gender,
  type CalculatorResult,
} from "./calculations";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const ACTIVITIES = Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][];

const kcal = (n: number) => `${Math.round(n).toLocaleString()} kcal/day`;
const round1 = (n: number) => n.toFixed(1);
const round2 = (n: number) => n.toFixed(2);

export default function HealthCalculatorPage() {
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [activity, setActivity] = useState<ActivityLevel>("sedentary");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculatorResult | null>(null);

  function parsePositive(raw: string): number | null {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const ageN = parsePositive(age);
    const weightN = parsePositive(weight);
    const heightN = parsePositive(height);

    if (!ageN || !weightN || !heightN) {
      setResult(null);
      setError("Please enter a valid age, weight, and height (positive numbers).");
      return;
    }

    const waistN = waist.trim() ? parsePositive(waist) : null;
    const hipN = hip.trim() ? parsePositive(hip) : null;

    setResult(
      calculate({
        age: ageN,
        weightKg: weightN,
        heightCm: heightN,
        gender,
        activity,
        waistCm: waistN,
        hipCm: hipN,
      }),
    );
  }

  function onReset() {
    setAge("");
    setWeight("");
    setHeight("");
    setGender("male");
    setActivity("sedentary");
    setWaist("");
    setHip("");
    setError(null);
    setResult(null);
  }

  return (
    <main className="dashboard">
      <p className="dashboard__eyebrow">Health tools</p>
      <h1>Health Metrics Calculator</h1>
      <p className="dashboard__welcome">
        Calculate your BMR, TDEE, and body composition metrics.
      </p>

      <form className="calc-form" onSubmit={onSubmit} noValidate>
        {error && (
          <ErrorBanner title="Check your inputs">
            <p>{error}</p>
          </ErrorBanner>
        )}

        <div className="calc-grid">
          <FormField label="Age (years)" htmlFor="age" required>
            <Input
              id="age"
              type="number"
              min="1"
              inputMode="numeric"
              placeholder="e.g. 34"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </FormField>

          <FormField label="Weight (kg)" htmlFor="weight" required>
            <Input
              id="weight"
              type="number"
              min="1"
              step="0.1"
              inputMode="decimal"
              placeholder="e.g. 72"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </FormField>

          <FormField label="Height (cm)" htmlFor="height" required>
            <Input
              id="height"
              type="number"
              min="1"
              step="0.1"
              inputMode="decimal"
              placeholder="e.g. 163"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </FormField>

          <FormField label="Gender" htmlFor="gender" required>
            <select
              id="gender"
              className="input"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
            >
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Activity level" htmlFor="activity" required>
            <select
              id="activity"
              className="input"
              value={activity}
              onChange={(e) => setActivity(e.target.value as ActivityLevel)}
            >
              {ACTIVITIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Waist circumference (cm)"
            htmlFor="waist"
            hint="Optional"
          >
            <Input
              id="waist"
              type="number"
              min="1"
              step="0.1"
              inputMode="decimal"
              placeholder="Optional"
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
            />
          </FormField>

          <FormField
            label="Hip circumference (cm)"
            htmlFor="hip"
            hint="Optional"
          >
            <Input
              id="hip"
              type="number"
              min="1"
              step="0.1"
              inputMode="decimal"
              placeholder="Optional"
              value={hip}
              onChange={(e) => setHip(e.target.value)}
            />
          </FormField>
        </div>

        <div className="calc-actions">
          <Button type="submit">Calculate</Button>
          <Button type="button" variant="secondary" onClick={onReset}>
            Reset
          </Button>
        </div>
      </form>

      {result && (
        <section className="calc-results" aria-label="Results">
          <div className="calc-cards">
            <ResultCard
              label="BMR"
              value={kcal(result.bmr)}
              note="Basal Metabolic Rate — energy at complete rest."
            />
            <ResultCard
              label="TDEE"
              value={kcal(result.tdee)}
              note="Total Daily Energy Expenditure at your activity level."
            />
            <ResultCard
              label="EER"
              value={kcal(result.eer)}
              note="Estimated Energy Requirement (same basis as TDEE)."
            />
            <ResultCard
              label="Body fat %"
              value={`${round1(result.bodyFatPct.value)}%`}
              category={result.bodyFatPct.category}
              note="Estimate only; clinical measurement requires skinfold calipers."
            />
            <ResultCard
              label="FFMI"
              value={round1(result.ffmi)}
              note="Fat-Free Mass Index (lean mass relative to height)."
            />
            <ResultCard
              label="FMI"
              value={round1(result.fmi)}
              note="Fat Mass Index (fat mass relative to height)."
            />
            {result.whr && (
              <ResultCard
                label="WHR"
                value={round2(result.whr.value)}
                category={result.whr.category}
                note="Waist-to-Hip Ratio."
              />
            )}
            {result.whtr && (
              <ResultCard
                label="WHtR"
                value={round2(result.whtr.value)}
                category={result.whtr.category}
                note="Waist-to-Height Ratio."
              />
            )}
          </div>

          {!result.whr && !result.whtr && (
            <p className="calc-hint">
              Add waist (and hip) measurements to also see your waist-based
              ratios.
            </p>
          )}
        </section>
      )}

      <p className="calc-disclaimer">
        These calculations are estimates. For personalized health advice,
        consult with a qualified healthcare professional.
      </p>
    </main>
  );
}

function ResultCard({
  label,
  value,
  category,
  note,
}: {
  label: string;
  value: string;
  category?: string;
  note?: string;
}) {
  return (
    <article className="calc-card">
      <p className="calc-card__label">{label}</p>
      <p className="calc-card__value">{value}</p>
      {category && <p className="calc-card__category">{category}</p>}
      {note && <p className="calc-card__note">{note}</p>}
    </article>
  );
}
