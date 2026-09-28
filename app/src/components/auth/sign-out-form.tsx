"use client";

import type { ComponentProps } from "react";
import { useUserStore } from "@/stores/user-store";

/**
 * A form that signs out via its server `action`, first dropping the signed-in
 * user's client state. Sign-out is a soft navigation, so without this the user
 * store (admin flag), cached queries and debug trace would outlive the session
 * (`SessionStateReset` clears the rest once the store empties). Use for every
 * sign-out form.
 */
export function SignOutForm({ onSubmit, ...props }: ComponentProps<"form">) {
  const clearUser = useUserStore((state) => state.clearUser);
  return (
    <form
      {...props}
      onSubmit={(event) => {
        onSubmit?.(event);
        // A caller cancelled: no sign-out happens, so keep the session's state
        if (!event.defaultPrevented) clearUser();
      }}
    />
  );
}
