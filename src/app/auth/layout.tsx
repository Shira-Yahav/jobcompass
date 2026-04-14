// Auth pages contact Supabase at render time; must not be statically prerendered.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
