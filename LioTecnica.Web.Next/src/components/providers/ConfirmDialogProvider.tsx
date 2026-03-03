"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type ConfirmDialogOptions, setConfirmDialogHandler } from "@/lib/confirm-dialog";

type PendingState = {
  open: boolean;
  options: Required<ConfirmDialogOptions>;
};

const defaultOptions: Required<ConfirmDialogOptions> = {
  title: "Confirmar ação",
  description: "",
  confirmText: "Confirmar",
  cancelText: "Cancelar",
  destructive: false,
};

export default function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PendingState>({ open: false, options: defaultOptions });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closeAndResolve = useCallback((result: boolean) => {
    setState((prev) => ({ ...prev, open: false }));
    const resolver = resolverRef.current;
    resolverRef.current = null;
    if (resolver) resolver(result);
  }, []);

  const openConfirm = useCallback((options: Required<ConfirmDialogOptions>) => {
    setState({ open: true, options });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  useEffect(() => {
    setConfirmDialogHandler(openConfirm);
    return () => {
      setConfirmDialogHandler(null);
    };
  }, [openConfirm]);

  const options = useMemo(() => state.options, [state.options]);

  return (
    <>
      {children}
      <Dialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) closeAndResolve(false);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{options.title}</DialogTitle>
            {options.description ? (
              <DialogDescription>{options.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeAndResolve(false)}>
              {options.cancelText}
            </Button>
            <Button
              variant={options.destructive ? "destructive" : "default"}
              onClick={() => closeAndResolve(true)}
            >
              {options.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
