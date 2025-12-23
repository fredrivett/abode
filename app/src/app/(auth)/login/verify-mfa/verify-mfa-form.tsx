"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { challengeAndVerifyMFA } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/client";

type VerifyMFAFormProps = {
  factorId: string;
};

export function VerifyMFAForm({ factorId }: VerifyMFAFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleVerify = async () => {
    if (code.length !== 6) return;

    setError(null);

    startTransition(async () => {
      try {
        const supabase = createClient();
        await challengeAndVerifyMFA(supabase, factorId, code);
        router.push("/dashboard");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid code");
        setCode("");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          onComplete={handleVerify}
          disabled={isPending}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && <p className="text-center text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleVerify}
        disabled={code.length !== 6 || isPending}
        className="w-full"
      >
        {isPending ? "Verifying..." : "Verify"}
      </Button>
    </div>
  );
}
