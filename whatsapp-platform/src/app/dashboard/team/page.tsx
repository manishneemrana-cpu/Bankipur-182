import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { readSession, requireOrgContext } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { hasPermission } from "@/server/permissions";
import { withOrgTransaction } from "@/server/db";
import { addTeamMember, removeMember, updateMemberRole } from "@/server/actions/team-actions";
import { RoleSelect } from "./role-select";

interface MemberRow {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
}

async function listMembers(organizationId: string, userId: string): Promise<MemberRow[]> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const result = await client.query<{ user_id: string; email: string; full_name: string | null; role: string }>(
      `SELECT m.user_id, u.email, u.full_name, m.role
       FROM organization_members m JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = $1 ORDER BY m.joined_at NULLS LAST, m.invited_at`,
      [organizationId]
    );
    return result.rows.map((r) => ({ userId: r.user_id, email: r.email, fullName: r.full_name, role: r.role }));
  });
}

export default async function TeamPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const context = await requireOrgContext(currentOrg.organizationId);
  const canManage = hasPermission(context.role, context.permissionOverrides, "manage_users");
  const members = await listMembers(currentOrg.organizationId, session.userId);

  async function addAction(formData: FormData) {
    "use server";
    await addTeamMember({
      organizationId: currentOrg!.organizationId,
      email: formData.get("email"),
      role: formData.get("role"),
    });
  }

  async function roleAction(formData: FormData) {
    "use server";
    await updateMemberRole({
      organizationId: currentOrg!.organizationId,
      memberUserId: formData.get("memberUserId"),
      role: formData.get("role"),
    });
  }

  async function removeAction(formData: FormData) {
    "use server";
    await removeMember({ organizationId: currentOrg!.organizationId, memberUserId: formData.get("memberUserId") });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Team</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Email invites for people without an account yet ship in a later phase — for now, the
          person registers their own account first, then an Owner or Admin adds them here.
        </p>
      </div>

      {canManage && (
        <form action={addAction} className="card flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 basis-48">
            <label className="mb-1 block text-xs font-medium text-ink-600">Email</label>
            <input name="email" type="email" required className="input-field" />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-ink-600">Role</label>
            <select name="role" defaultValue="AGENT" className="input-field">
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="AGENT">Agent</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Add to team
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-t border-ink-100">
                <td className="px-4 py-3 font-medium text-ink-900">{m.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-ink-500">{m.email}</td>
                <td className="px-4 py-3">
                  <RoleSelect memberUserId={m.userId} currentRole={m.role} disabled={!canManage} action={roleAction} />
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <form action={removeAction}>
                      <input type="hidden" name="memberUserId" value={m.userId} />
                      <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <Users className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">No team members.</p>
        </div>
      )}
    </div>
  );
}
