"use client";

import { useMemo, useState } from "react";

import { calculateEmi, totalCostEstimate } from "@/lib/finance/emi";
import { formatIndianCurrency } from "@/lib/format";
import type { Lang } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";

export function EmiCalculator({
  priceTotal,
  lang,
}: {
  priceTotal: number | null;
  lang: Lang;
}) {
  const [rate, setRate] = useState(9);
  const [years, setYears] = useState(15);
  const [devPercent, setDevPercent] = useState(0);
  const [regPercent, setRegPercent] = useState(0);

  const total = useMemo(
    () =>
      priceTotal
        ? totalCostEstimate(priceTotal, {
            developmentPercent: devPercent,
            registrationPercent: regPercent,
          })
        : null,
    [priceTotal, devPercent, regPercent],
  );
  const emi = useMemo(
    () =>
      total
        ? calculateEmi({
            principal: total,
            annualRatePercent: rate,
            tenureYears: years,
          })
        : null,
    [total, rate, years],
  );

  if (!priceTotal) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(lang, "contactSalesTeam")}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t(lang, "plotPrice")}>
          <span className="tabular font-medium">
            {formatIndianCurrency(priceTotal)}
          </span>
        </Field>
        <Field label="Development %">
          <input
            type="number"
            min={0}
            max={50}
            value={devPercent}
            onChange={(e) => setDevPercent(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-input px-2"
          />
        </Field>
        <Field label="Registration/stamp duty %">
          <input
            type="number"
            min={0}
            max={20}
            value={regPercent}
            onChange={(e) => setRegPercent(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-input px-2"
          />
        </Field>
        <Field label="Total estimate">
          <span className="tabular font-medium">
            {total ? formatIndianCurrency(total) : "—"}
          </span>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t(lang, "interestRatePercent")}>
          <input
            type="number"
            min={0}
            max={25}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-input px-2"
          />
        </Field>
        <Field label={t(lang, "loanTenureYears")}>
          <input
            type="number"
            min={1}
            max={30}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-input px-2"
          />
        </Field>
      </div>

      {emi ? (
        <div className="flex flex-wrap gap-6 rounded-md bg-accent/50 p-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {t(lang, "monthlyEmi")}
            </p>
            <p className="tabular text-lg font-semibold">
              {formatIndianCurrency(emi.monthlyEmi)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t(lang, "totalPayment")}
            </p>
            <p className="tabular text-lg font-semibold">
              {formatIndianCurrency(emi.totalPayment)}
            </p>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t(lang, "indicativeEstimate")}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
