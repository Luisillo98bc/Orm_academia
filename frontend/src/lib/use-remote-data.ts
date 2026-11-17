"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";

export function useRemoteData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await fetchApi(path) as T;
      if (current === generation.current) setData(result);
    } catch (err) {
      if (current === generation.current) setError(getErrorMessage(err, "No pudimos cargar esta sección."));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    const requestGeneration = generation;
    const timer = window.setTimeout(() => void reload(), 0);
    return () => { window.clearTimeout(timer); requestGeneration.current++; };
  }, [reload]);
  return { data, loading, error, reload };
}
