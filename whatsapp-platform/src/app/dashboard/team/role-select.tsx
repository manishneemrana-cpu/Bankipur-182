"use client";

import { useRef } from "react";

const ROLES = ["OWNER", "ADMIN", "MANAGER", "AGENT", "VIEWER"] as const;

export function RoleSelect({
  memberUserId,
  currentRole,
  disabled,
  action,
}: {
  memberUserId: string;
  currentRole: string;
  disabled: boolean;
  action: (formData: FormData) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={formRef}>
      <input type="hidden" name="memberUserId" value={memberUserId} />
      <select
        name="role"
        defaultValue={currentRole}
        disabled={disabled}
        onChange={() => formRef.current?.requestSubmit()}
        className="input-field py-1 text-xs disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </form>
  );
}
