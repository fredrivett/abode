"use client";

import { Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  enrollMFA,
  getMFAFactors,
  type MFAFactor,
  unenrollMFA,
  verifyMFAEnrollment,
} from "@/lib/mfa";
import { createClient } from "@/lib/supabase/client";

type SecuritySettingsProps = {
  initialFactors: MFAFactor[];
};

export function SecuritySettings({ initialFactors }: SecuritySettingsProps) {
  const [factors, setFactors] = useState<MFAFactor[]>(initialFactors);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const verifiedFactor = factors.find((f) => f.status === "verified");
  const hasMFA = !!verifiedFactor;

  const handleDisableMFA = useCallback(async () => {
    if (!verifiedFactor) return;

    setIsDisabling(true);
    try {
      const supabase = createClient();
      await unenrollMFA(supabase, verifiedFactor.id);
      setFactors([]);
      toast.success("Two-factor authentication disabled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to disable MFA",
      );
    } finally {
      setIsDisabling(false);
    }
  }, [verifiedFactor]);

  const handleEnrollComplete = useCallback(async () => {
    const supabase = createClient();
    const updatedFactors = await getMFAFactors(supabase);
    setFactors(updatedFactors);
    setIsEnrollDialogOpen(false);
    toast.success("Two-factor authentication enabled");
  }, []);

  return (
    <section className="rounded-xl border p-6">
      <h3 className="text-lg font-semibold">Security</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your account security settings.
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            {hasMFA ? (
              <ShieldCheck className="size-5 text-green-600" />
            ) : (
              <Shield className="size-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Two-factor authentication</p>
              <p className="text-sm text-muted-foreground">
                {hasMFA
                  ? "Your account is protected with an authenticator app"
                  : "Add an extra layer of security to your account"}
              </p>
            </div>
          </div>
          <div>
            {hasMFA ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisableMFA}
                disabled={isDisabling}
              >
                <ShieldOff className="size-4" />
                {isDisabling ? "Disabling..." : "Disable"}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsEnrollDialogOpen(true)}
              >
                <Shield className="size-4" />
                Enable
              </Button>
            )}
          </div>
        </div>
      </div>

      <MFAEnrollDialog
        open={isEnrollDialogOpen}
        onOpenChange={setIsEnrollDialogOpen}
        onComplete={handleEnrollComplete}
      />
    </section>
  );
}

type MFAEnrollDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

function MFAEnrollDialog({
  open,
  onOpenChange,
  onComplete,
}: MFAEnrollDialogProps) {
  const [step, setStep] = useState<"qr" | "verify">("qr");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEnrollment = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const result = await enrollMFA(supabase);
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setFactorId(result.factorId);
      setStep("qr");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start MFA setup",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start enrollment when dialog opens
  useEffect(() => {
    if (open && !qrCode && !isLoading && !error) {
      void startEnrollment();
    }
  }, [open, qrCode, isLoading, error, startEnrollment]);

  const handleVerify = useCallback(async () => {
    if (!factorId || code.length !== 6) return;

    setIsVerifying(true);
    setError(null);
    try {
      const supabase = createClient();
      await verifyMFAEnrollment(supabase, factorId, code);
      onComplete();
      // Reset state
      setStep("qr");
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setIsVerifying(false);
    }
  }, [factorId, code, onComplete]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state when closing
        setStep("qr");
        setQrCode(null);
        setSecret(null);
        setFactorId(null);
        setCode("");
        setError(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up two-factor authentication</DialogTitle>
          <DialogDescription>
            Scan the QR code with your authenticator app, then enter the
            verification code.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error && !qrCode ? (
          <div className="py-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={startEnrollment} className="mt-4" size="sm">
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {step === "qr" && qrCode ? (
              <>
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-lg bg-white p-3">
                    {/* biome-ignore lint/performance/noImgElement: QR code is a data URI (base64), which Next.js Image doesn't support */}
                    <img
                      src={qrCode}
                      alt="QR Code for two-factor authentication"
                      className="size-48"
                    />
                  </div>
                  {secret && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        Or enter this code manually:
                      </p>
                      <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-xs">
                        {secret}
                      </code>
                    </div>
                  )}
                </div>
                <Button onClick={() => setStep("verify")} className="w-full">
                  Continue
                </Button>
              </>
            ) : step === "qr" && !qrCode ? (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Waiting for QR code...
                </p>
              </div>
            ) : null}

            {step === "verify" && (
              <>
                <div className="space-y-4">
                  <p className="text-center text-sm text-muted-foreground">
                    Enter the 6-digit code from your authenticator app
                  </p>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={code}
                      onChange={setCode}
                      onComplete={handleVerify}
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
                  {error && (
                    <p className="text-center text-sm text-destructive">
                      {error}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep("qr")}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleVerify}
                    disabled={code.length !== 6 || isVerifying}
                    className="flex-1"
                  >
                    {isVerifying ? "Verifying..." : "Verify"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
