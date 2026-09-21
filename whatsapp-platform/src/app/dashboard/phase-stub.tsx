export function PhaseStub({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
    </div>
  );
}
