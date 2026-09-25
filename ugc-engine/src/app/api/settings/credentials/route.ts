import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext } from "@/lib/auth/tenant";
import { errorResponse } from "@/app/api/projects/route";
import { CredentialsRepository } from "@/lib/settings/CredentialsRepository";
import { ALL_CREDENTIAL_KEYS, SECRET_CREDENTIAL_KEYS } from "@/lib/settings/credentialCatalog";

/** GET /api/settings/credentials — masked view of this org's stored keys (secrets never sent back in full). */
export async function GET(req: NextRequest) {
  try {
    const tenant = requireTenantContext(req);
    const values = await CredentialsRepository.getAllMasked(tenant.organizationId, SECRET_CREDENTIAL_KEYS);
    return NextResponse.json({ values });
  } catch (error) {
    return errorResponse(error);
  }
}

const schema = z.object({ values: z.record(z.string(), z.string()) });

/** POST /api/settings/credentials — save/update this org's provider keys. A blank value clears that key. */
export async function POST(req: NextRequest) {
  try {
    const tenant = requireTenantContext(req);
    const { values } = schema.parse(await req.json());

    const unknownKeys = Object.keys(values).filter((k) => !ALL_CREDENTIAL_KEYS.includes(k));
    if (unknownKeys.length) {
      return NextResponse.json({ error: `Unknown credential key(s): ${unknownKeys.join(", ")}` }, { status: 400 });
    }

    await CredentialsRepository.setMany(tenant.organizationId, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
