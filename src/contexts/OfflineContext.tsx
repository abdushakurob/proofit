"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { get, set } from "idb-keyval";

const OFFLINE_QUEUE_KEY = "proofit_offline_queue";

export interface PendingOfflineRecord {
  id: string;
  type: "evidence" | "custody";
  data: any;
  timestamp: string;
}

interface OfflineContextType {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  toggleSimulatedOffline: () => void;
  pendingQueue: PendingOfflineRecord[];
  queueOfflineRecord: (record: PendingOfflineRecord) => Promise<void>;
  syncOfflineQueue: () => Promise<{ success: boolean; count: number }>;
  isSyncing: boolean;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [pendingQueue, setPendingQueue] = useState<PendingOfflineRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Load queued offline records on mount
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const queue = await get<PendingOfflineRecord[]>(OFFLINE_QUEUE_KEY);
        if (queue && Array.isArray(queue)) {
          setPendingQueue(queue);
        }
      } catch (err) {
        console.error("Failed to load offline queue:", err);
      }
    };

    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      loadQueue();

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const toggleSimulatedOffline = useCallback(() => {
    setIsSimulatedOffline((prev) => !prev);
  }, []);

  const effectiveOnline = isOnline && !isSimulatedOffline;

  const queueOfflineRecord = useCallback(async (record: PendingOfflineRecord) => {
    try {
      const current = (await get<PendingOfflineRecord[]>(OFFLINE_QUEUE_KEY)) || [];
      const updated = [...current, record];
      await set(OFFLINE_QUEUE_KEY, updated);
      setPendingQueue(updated);
    } catch (err) {
      console.error("Failed to queue offline record:", err);
    }
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    if (!effectiveOnline) {
      return { success: false, count: 0 };
    }

    setIsSyncing(true);
    try {
      const queue = (await get<PendingOfflineRecord[]>(OFFLINE_QUEUE_KEY)) || [];
      if (queue.length === 0) {
        setIsSyncing(false);
        return { success: true, count: 0 };
      }

      const items = queue.filter((r) => r.type === "evidence").map((r) => r.data);
      const custodyRecords = queue.filter((r) => r.type === "custody").map((r) => r.data);

      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, custodyRecords }),
      });

      const data = await res.json();
      if (data.success) {
        await set(OFFLINE_QUEUE_KEY, []);
        setPendingQueue([]);
        setIsSyncing(false);
        return { success: true, count: queue.length };
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
    setIsSyncing(false);
    return { success: false, count: 0 };
  }, [effectiveOnline]);

  // Auto-sync when effective connection is restored
  useEffect(() => {
    if (effectiveOnline && pendingQueue.length > 0) {
      syncOfflineQueue();
    }
  }, [effectiveOnline, pendingQueue.length, syncOfflineQueue]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline: effectiveOnline,
        isSimulatedOffline,
        toggleSimulatedOffline,
        pendingQueue,
        queueOfflineRecord,
        syncOfflineQueue,
        isSyncing,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}
