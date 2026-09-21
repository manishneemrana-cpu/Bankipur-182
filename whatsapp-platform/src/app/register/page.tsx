import { registerOrganization } from "@/server/actions/auth-actions";
import { redirect } from "next/navigation";

export default function RegisterPage() {
  async function registerAction(formData: FormData) {
    "use server";
    const result = await registerOrganization({
      organizationName: formData.get("organizationName"),
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (result.ok) redirect("/dashboard");
    redirect(`/register?error=${encodeURIComponent(result.error ?? "Registration failed")}`);
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-xl font-semibold">Register your organization</h1>
      <form action={registerAction} className="mt-6 flex flex-col gap-3">
        <input
          name="organizationName"
          placeholder="Organization name"
          required
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          name="fullName"
          placeholder="Your name"
          required
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          name="email"
          type="email"
          placeholder="you@company.com"
          required
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password (min 10 characters)"
          required
          minLength={10}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white">
          Create organization
        </button>
      </form>
    </main>
  );
}
