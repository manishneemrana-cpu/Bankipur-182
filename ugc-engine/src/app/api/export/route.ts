import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { withTenant } from "@/lib/db/client";
import { looseUuid } from "@/lib/validation/uuid";

const schema = z.object({ projectId: looseUuid });

/**
 * GET-style export bundle (spec section 55): final video + script + shot
 * list + captions + thumbnail + hook + project metadata, in one payload.
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = requireTenantContext(req);
    const { projectId } = schema.parse(await req.json());

    const bundle = await withTenant(tenant.organizationId, async (client) => {
      const project = await client.query(`SELECT * FROM projects WHERE id = $1`, [projectId]);
      const strategy = await client.query(
        `SELECT * FROM creative_strategies WHERE project_id = $1 ORDER BY version DESC LIMIT 1`,
        [projectId]
      );
      const scenes = await client.query(`SELECT * FROM scenes WHERE project_id = $1 ORDER BY scene_number ASC`, [projectId]);
      const renders = await client.query(`SELECT * FROM renders WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`, [projectId]);

      return {
        project: project.rows[0] ?? null,
        strategy: strategy.rows[0] ?? null,
        scenes: scenes.rows,
        render: renders.rows[0] ?? null,
      };
    });

    if (!bundle.project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    return NextResponse.json({ export: bundle });
  } catch (error) {
    return errorResponse(error);
  }
}
