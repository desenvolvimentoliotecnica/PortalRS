"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)";

function subscribe(cb: () => void) {
    const mq = window.matchMedia(QUERY);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
}

function getSnapshot(): boolean {
    return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
    return false;
}

/** True when Tailwind breakpoint is below `md` (fullscreen form preferred over dialog). */
export function useMobileSolicitacaoFormPreferred(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
