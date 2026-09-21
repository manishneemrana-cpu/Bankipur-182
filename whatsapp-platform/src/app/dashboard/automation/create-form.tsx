"use client";

import { useState } from "react";

export function CreateAutomationForm({ action }: { action: (formData: FormData) => void }) {
  const [triggerType, setTriggerType] = useState("welcome_message");

  return (
    <form action={action} className="card flex flex-col gap-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Name</label>
          <input name="name" required className="input-field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Trigger</label>
          <select
            name="triggerType"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
            className="input-field"
          >
            <option value="welcome_message">Welcome message (first message from a new contact)</option>
            <option value="keyword_auto_reply">Keyword auto-reply</option>
            <option value="business_hours_away">Away message outside business hours</option>
          </select>
        </div>
      </div>

      {triggerType === "keyword_auto_reply" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Keywords (comma-separated)</label>
          <input name="keywords" placeholder="price, brochure, site visit" className="input-field" />
        </div>
      )}

      {triggerType === "business_hours_away" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">Start (UTC, HH:MM)</label>
            <input name="hoursStart" placeholder="09:00" className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">End (UTC, HH:MM)</label>
            <input name="hoursEnd" placeholder="18:00" className="input-field" />
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-600">Reply message</label>
        <input name="replyBody" required className="input-field" />
      </div>

      <button type="submit" className="btn-primary self-start">
        Create automation
      </button>
    </form>
  );
}
