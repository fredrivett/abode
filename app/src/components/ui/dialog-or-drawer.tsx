"use client";

import type * as React from "react";
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
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function DialogOrDrawer({ children, ...props }: DialogOrDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

  if (isDesktop) {
    return <Dialog {...props}>{children}</Dialog>;
  }

  return <Drawer {...props}>{children}</Drawer>;
}

function DialogOrDrawerTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

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
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

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
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

  if (isDesktop) {
    return <DialogHeader className={className} {...props} />;
  }

  return <DrawerHeader className={className} {...props} />;
}

function DialogOrDrawerBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

  if (isDesktop) {
    return <DialogBody className={className} {...props} />;
  }

  return <DrawerBody className={className} {...props} />;
}

function DialogOrDrawerFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

  if (isDesktop) {
    return <DialogFooter className={className} {...props} />;
  }

  return <DrawerFooter className={className} {...props} />;
}

function DialogOrDrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

  if (isDesktop) {
    return <DialogTitle className={className} {...props} />;
  }

  return <DrawerTitle className={className} {...props} />;
}

function DialogOrDrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

  if (isDesktop) {
    return <DialogDescription className={className} {...props} />;
  }

  return <DrawerDescription className={className} {...props} />;
}

function DialogOrDrawerClose({
  className,
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const isDesktop = useMediaQuery("(min-width: 768px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

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
