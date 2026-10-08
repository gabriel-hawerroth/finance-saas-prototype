"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";

export function useOverallBalance() {
  return useQuery({ queryKey: qk.overall, queryFn: api.accounts.overallBalance });
}

export function useTypeDefaults(enabled: boolean) {
  return useQuery({ queryKey: qk.typeDefaults, queryFn: api.accounts.typeDefaults, enabled, staleTime: Infinity });
}
