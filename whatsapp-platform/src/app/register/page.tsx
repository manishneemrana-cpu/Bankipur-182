import Link from "next/link";
import { redirect } from "next/navigation";
import { registerOrganization } from "@/server/actions/auth-actions";
import { getEnv } from "@/server/env";
import { Logo } from "@/components/logo";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const env = getEnv();
  const { error } = await searchParams;

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 py-12">
      <Link href="/" className="mb-8">
        <Logo brandName={env.PLATFORM_BRAND_NAME} />
      </Link>

      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold text-ink-900">Register your organization</h1>
        <p className="mt-1 text-sm text-ink-500">You&apos;ll be the Owner of this account.</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <form action={registerAction} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Organization name</label>
            <input name="organizationName" placeholder="Magadh Property" required className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Your name</label>
            <input name="fullName" placeholder="Full name" required className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Email</label>
            <input name="email" type="email" placeholder="you@company.com" required className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Password</label>
            <input
              name="password"
              type="password"
              placeholder="Min. 10 characters"
              required
              minLength={10}
              className="input-field"
            />
          </div>
          <button type="submit" className="btn-primary mt-2 w-full">
            Create organization
          </button>
        </form>
      </div>

      <p className="mt-6 text-sm text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Log in
        </Link>
      </p>
    </main>
  );
}
