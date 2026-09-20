"use client";

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { OfficerProfile, AuthState } from "@/types";
import {
  getOrCreateMiniKey,
  deriveFactorB,
  synthesizeKeypair,
  deriveDeterministicKeypair,
  exportPublicStamp,
} from "@/modules/vault/splitKey";
import { saveProfile, loadProfile, hasProfile } from "@/modules/vault/profileStore";
import { del } from "idb-keyval";

/* ── Context Definition ──────────────────────────────────── */

interface AuthContextValue extends AuthState {
  unlock: (badgeId: string, password: string, profile?: OfficerProfile) => Promise<void>;
  lock: () => void;
  enroll: (badgeId: string, password: string, profile: OfficerProfile) => Promise<void>;
  enrollOfficer: (profile: OfficerProfile, password: string) => Promise<void>;
  isEnrolled: (badgeId: string) => Promise<boolean>;
  isUnlocked: boolean;
  currentOfficer: OfficerProfile | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    officer: null,
    keypair: null,
    publicStamp: null,
    isAuthenticated: false,
  });

  const enroll = useCallback(async (badgeId: string, password: string, profile: OfficerProfile) => {
    const keypair = await deriveDeterministicKeypair(badgeId, password);
    const publicStamp = await exportPublicStamp(keypair.publicKey);

    const fullProfile: OfficerProfile = {
      ...profile,
      publicStamp,
    };

    await saveProfile(badgeId, password, fullProfile);

    // Sync generated public stamp to central OIN database
    try {
      await fetch("/api/officers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oin: badgeId,
          public_stamp: publicStamp,
          status: "Active",
        }),
      });
    } catch (err) {
      // Ignore network errors during background sync
    }
  }, []);

  const enrollOfficer = useCallback(async (profile: OfficerProfile, password: string) => {
    await enroll(profile.badgeId, password, profile);
    await unlock(profile.badgeId, password, profile);
  }, [enroll]);

  const isEnrolled = useCallback(async (badgeId: string) => {
    return hasProfile(badgeId);
  }, []);

  const unlock = useCallback(async (badgeId: string, password: string, profile?: OfficerProfile) => {
    const keypair = await deriveDeterministicKeypair(badgeId, password);
    const publicStamp = await exportPublicStamp(keypair.publicKey);

    let officer: OfficerProfile;
    const profileExists = await hasProfile(badgeId);

    if (profileExists) {
      try {
        officer = await loadProfile(badgeId, password);
      } catch (err) {
        throw new Error("Invalid Master Password: The password entered does not match your registered credentials.");
      }
    } else if (profile) {
      officer = { ...profile, publicStamp };
    } else {
      officer = await loadProfile(badgeId, password);
    }

    // Cryptographic Passkey Verification Check across device sessions
    if (officer.publicStamp && officer.publicStamp !== publicStamp) {
      throw new Error("Invalid Master Password: The password entered does not match your registered keypair.");
    }

    sessionStorage.setItem("proofit_active_badge", badgeId);
    sessionStorage.setItem("proofit_passcode", password);
    localStorage.setItem("proofit_last_badge", badgeId);

    setState({
      officer: { ...officer, publicStamp },
      keypair,
      publicStamp,
      isAuthenticated: true,
    });
  }, []);

  // Auto-restore officer authentication state from sessionStorage on page mount/reload
  React.useEffect(() => {
    const savedBadge = sessionStorage.getItem("proofit_active_badge");
    const savedPasscode = sessionStorage.getItem("proofit_passcode");

    if (savedBadge && savedPasscode && !state.isAuthenticated) {
      unlock(savedBadge, savedPasscode).catch(() => {
        sessionStorage.removeItem("proofit_active_badge");
        sessionStorage.removeItem("proofit_passcode");
      });
    }
  }, [unlock, state.isAuthenticated]);

  const lock = useCallback(() => {
    const currentBadge = sessionStorage.getItem("proofit_active_badge") || localStorage.getItem("proofit_last_badge");
    sessionStorage.removeItem("proofit_active_badge");
    sessionStorage.removeItem("proofit_passcode");
    localStorage.removeItem("proofit_last_badge");
    del("proofit_active_bag").catch(() => {});
    if (currentBadge) {
      del(`proofit_active_bag_${currentBadge}`).catch(() => {});
    }
    setState({
      officer: null,
      keypair: null,
      publicStamp: null,
      isAuthenticated: false,
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isUnlocked: state.isAuthenticated,
        currentOfficer: state.officer,
        unlock,
        lock,
        enroll,
        enrollOfficer,
        isEnrolled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
