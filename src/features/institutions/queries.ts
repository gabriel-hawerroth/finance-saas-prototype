"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";

/** Catalogue loaded once per session (§5.9). */
export function useInstitutions() {
  return useQuery({ queryKey: qk.institutions, queryFn: api.institutions.list, staleTime: Infinity, gcTime: Infinity });
}
