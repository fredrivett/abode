import { getSafeRedirectPath } from "@/lib/url-utils";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const safeNext = getSafeRedirectPath(next);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">
            Welcome back
          </h1>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            Sign in to your account
          </p>
        </div>

        <LoginForm next={safeNext} />

        <p className="text-center text-gray-500 text-sm dark:text-gray-400">
          have an invite?{" "}
          <a
            href="/join"
            className="font-medium text-gray-900 hover:underline dark:text-gray-100"
          >
            join abode
          </a>
        </p>
      </div>
    </div>
  );
}
