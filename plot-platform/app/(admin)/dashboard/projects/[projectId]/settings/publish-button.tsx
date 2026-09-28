"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { publishProject } from "./actions";

export function PublishButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await publishProject(projectId);
          router.refresh();
        })
      }
      className="w-fit rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
    >
      {pending ? "Publishing…" : "Publish project"}
    </button>
  );
}
