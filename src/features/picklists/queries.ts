"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";

export function useAccounts() {
  return useQuery({ queryKey: qk.accounts, queryFn: api.accounts.list });
}

export function useCards() {
  return useQuery({ queryKey: qk.cards, queryFn: api.cards.list });
}

export function useCategories() {
  return useQuery({ queryKey: qk.categories, queryFn: api.categories.listWithSubs });
}

/** Session pick lists used by every form (§5.12). The global "+" waits for them. */
export function usePicklists() {
  const accounts = useAccounts();
  const cards = useCards();
  const categories = useCategories();
  return {
    accounts: accounts.data ?? [],
    cards: cards.data ?? [],
    categories: categories.data ?? [],
    ready: accounts.isSuccess && cards.isSuccess && categories.isSuccess,
  };
}
