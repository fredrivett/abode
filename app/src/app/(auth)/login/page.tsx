import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sign in to your account
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
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
