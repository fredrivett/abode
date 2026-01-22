"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { IsLoading } from "@/components/ui/is-loading";
import { challengeAndVerifyMFA } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/client";

type AdminVerifyFormProps = {
  factorId: string;
};

export function AdminVerifyForm({ factorId }: AdminVerifyFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6 || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      await challengeAndVerifyMFA(supabase, factorId, code);
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
      setCode("");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          onComplete={handleVerify}
          disabled={isLoading}
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

      {error && <p className="text-center text-destructive text-sm">{error}</p>}

      <Button
        onClick={handleVerify}
        disabled={code.length !== 6 || isLoading}
        className="w-full"
      >
        {isLoading ? <IsLoading label="Verifying" /> : "Verify"}
      </Button>
    </div>
  );
}
