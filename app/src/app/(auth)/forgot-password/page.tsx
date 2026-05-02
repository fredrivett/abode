import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <ForgotPasswordForm />

        <p className="text-center text-gray-500 text-sm dark:text-gray-400">
          Remembered it?{" "}
          <a
            href="/login"
            className="font-medium text-gray-900 hover:underline dark:text-gray-100"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
