"use client";

import type * as React from "react";
import { createContext, useContext } from "react";
import { useMediaQuery } from "usehooks-ts";

import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface DialogOrDrawerProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Shares the root's `isDesktop` decision with all sub-components so every part
 * of one dialog tree renders the same variant. Without this, each sub-component
 * runs its own `useMediaQuery` and their effects can commit in different passes
 * — momentarily rendering a `DialogContent` inside a `Drawer` root (or vice
 * versa), which throws "DialogPortal must be used within Dialog".
 */
const DialogOrDrawerContext = createContext<boolean | null>(null);

/** Returns the root's shared decision, falling back to a local query if unwrapped */
function useIsDesktop() {
  const contextValue = useContext(DialogOrDrawerContext);
  const localValue = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });
  return contextValue ?? localValue;
}

function DialogOrDrawer({ children, ...props }: DialogOrDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

  return (
    <DialogOrDrawerContext.Provider value={isDesktop}>
      {isDesktop ? (
        <Dialog {...props}>{children}</Dialog>
      ) : (
        <Drawer {...props}>{children}</Drawer>
      )}
    </DialogOrDrawerContext.Provider>
  );
}

function DialogOrDrawerTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DialogTrigger className={className} {...props}>
        {children}
      </DialogTrigger>
    );
  }

  return (
    <DrawerTrigger className={className} {...props}>
      {children}
    </DrawerTrigger>
  );
}

function DialogOrDrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DialogContent className={className} {...props}>
        {children}
      </DialogContent>
    );
  }

  return (
    <DrawerContent className={className} {...props}>
      {children}
    </DrawerContent>
  );
}

function DialogOrDrawerHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <DialogHeader className={className} {...props} />;
  }

  return <DrawerHeader className={className} {...props} />;
}

function DialogOrDrawerBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <DialogBody className={className} {...props} />;
  }

  return <DrawerBody className={className} {...props} />;
}

function DialogOrDrawerFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <DialogFooter className={className} {...props} />;
  }

  return <DrawerFooter className={className} {...props} />;
}

function DialogOrDrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <DialogTitle className={className} {...props} />;
  }

  return <DrawerTitle className={className} {...props} />;
}

function DialogOrDrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <DialogDescription className={className} {...props} />;
  }

  return <DrawerDescription className={className} {...props} />;
}

function DialogOrDrawerClose({
  className,
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <DialogClose className={className} {...props} />;
  }

  return <DrawerClose className={className} {...props} />;
}

export {
  DialogOrDrawer,
  DialogOrDrawerBody,
  DialogOrDrawerClose,
  DialogOrDrawerContent,
  DialogOrDrawerDescription,
  DialogOrDrawerFooter,
  DialogOrDrawerHeader,
  DialogOrDrawerTitle,
  DialogOrDrawerTrigger,
};
