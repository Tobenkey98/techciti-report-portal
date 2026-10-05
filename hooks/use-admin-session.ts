"use client";

import * as React from "react";
import { auth } from "@/lib/api";
import type { AdminSession } from "@/lib/types";

interface AdminSessionState {
  session: AdminSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AdminSession>;
  signOut: () => Promise<void>;
}

/**
 * Client-side admin session.
 *
 * The mock backend keeps the session in localStorage. A real backend should
 * return an httpOnly cookie instead — nothing else in the app changes, because
 * the UI only ever asks `useAdminSession()` for the truth.
 */
let cache: AdminSession | null = null;
let cacheLoaded = false;

export function useAdminSession(): AdminSessionState {
  const [session, setSession] = React.useState<AdminSession | null>(cache);
  const [loading, setLoading] = React.useState(!cacheLoaded);

  React.useEffect(() => {
    if (cacheLoaded) {
      setLoading(false);
      return;
    }
    let active = true;
    void auth.getSession().then((stored) => {
      if (!active) return;
      cache = stored;
      cacheLoaded = true;
      setSession(stored);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const next = await auth.login(email, password);
    cache = next;
    cacheLoaded = true;
    setSession(next);
    return next;
  }, []);

  const signOut = React.useCallback(async () => {
    await auth.logout();
    cache = null;
    cacheLoaded = true;
    setSession(null);
  }, []);

  return { session, loading, signIn, signOut };
}