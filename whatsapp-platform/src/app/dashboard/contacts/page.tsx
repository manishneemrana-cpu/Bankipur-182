import { redirect } from "next/navigation";
import { Contact as ContactIcon } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { withOrgTransaction } from "@/server/db";
import { createContact, deleteContact, toggleContactSuppressed } from "@/server/actions/contact-actions";

interface ContactRow {
  id: string;
  phone_e164: string;
  name: string | null;
  tags: string[];
  opt_in_status: string;
  suppressed: boolean;
}

async function listContacts(organizationId: string, userId: string): Promise<ContactRow[]> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const result = await client.query<ContactRow>(
      "SELECT id, phone_e164, name, tags, opt_in_status, suppressed FROM contacts WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 200",
      [organizationId]
    );
    return result.rows;
  });
}

export default async function ContactsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const contacts = await listContacts(currentOrg.organizationId, session.userId);

  async function createAction(formData: FormData) {
    "use server";
    await createContact({
      organizationId: currentOrg!.organizationId,
      phoneE164: formData.get("phoneE164"),
      name: formData.get("name"),
      tags: formData.get("tags"),
    });
  }

  async function toggleAction(formData: FormData) {
    "use server";
    await toggleContactSuppressed({ organizationId: currentOrg!.organizationId, contactId: formData.get("contactId") });
  }

  async function deleteAction(formData: FormData) {
    "use server";
    await deleteContact({ organizationId: currentOrg!.organizationId, contactId: formData.get("contactId") });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Contacts</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Import/export and bulk tools ship in a later phase. Adding a contact here records an
          explicit manual opt-in.
        </p>
      </div>

      <form action={createAction} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 basis-40">
          <label className="mb-1 block text-xs font-medium text-ink-600">Phone (with country code)</label>
          <input name="phoneE164" placeholder="+919876543210" required className="input-field" />
        </div>
        <div className="flex-1 basis-40">
          <label className="mb-1 block text-xs font-medium text-ink-600">Name</label>
          <input name="name" placeholder="Optional" className="input-field" />
        </div>
        <div className="flex-1 basis-40">
          <label className="mb-1 block text-xs font-medium text-ink-600">Tags</label>
          <input name="tags" placeholder="lead, 3bhk (comma-separated)" className="input-field" />
        </div>
        <button type="submit" className="btn-primary">
          Add contact
        </button>
      </form>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <ContactIcon className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">No contacts yet — add one above.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Opt-in</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium text-ink-900">{c.phone_e164}</td>
                  <td className="px-4 py-3 text-ink-500">{c.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-500">
                    {c.tags.length > 0 ? c.tags.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.suppressed ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Suppressed
                      </span>
                    ) : (
                      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                        {c.opt_in_status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <form action={toggleAction}>
                        <input type="hidden" name="contactId" value={c.id} />
                        <button type="submit" className="text-xs font-medium text-amber-700 hover:underline">
                          {c.suppressed ? "Un-suppress" : "Suppress"}
                        </button>
                      </form>
                      <form action={deleteAction}>
                        <input type="hidden" name="contactId" value={c.id} />
                        <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
