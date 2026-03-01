/**
 * useDashboardQuery
 * ─────────────────
 * Provides all dashboard data via @tanstack/vue-query.
 * Each query maps 1:1 to an existing dashboardService call so the data
 * format is identical to the manual-polling approach used by DashboardView,
 * but with proper caching, background refetch, and deduplication.
 *
 * Usage in DashboardView (or any view):
 *   const { stats, hunts, clients, isLoading, isError } = useDashboardQuery()
 */

import { computed } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import dashboardService from '@/services/dashboard.service'

// ── Query keys – centralised so invalidation is consistent ───────────────────
export const DASH_KEYS = {
  overview:  ['dashboard', 'overview'],
  clients:   ['dashboard', 'clients'],
  hunts:     ['dashboard', 'hunts'],
  activity:  ['dashboard', 'activity'],
}

// ── Individual queries ────────────────────────────────────────────────────────

/** System-wide counts (total clients, hunts, events…) */
export const useOverviewQuery = (opts = {}) =>
  useQuery({
    queryKey: DASH_KEYS.overview,
    queryFn:  () => dashboardService.getOverview(),
    refetchInterval: 30_000,
    ...opts,
  })

/** Recent clients list (last ~50) */
export const useClientsQuery = (opts = {}) =>
  useQuery({
    queryKey: DASH_KEYS.clients,
    queryFn:  () => dashboardService.getRecentClients(),
    refetchInterval: 45_000,
    ...opts,
  })

/** Hunts data – used for coverage / status / weekly activity */
export const useHuntsQuery = (opts = {}) =>
  useQuery({
    queryKey: DASH_KEYS.hunts,
    queryFn:  () => dashboardService.getHunts(),
    refetchInterval: 60_000,
    ...opts,
  })

/** Client activity histogram (last 14 days) */
export const useActivityQuery = (opts = {}) =>
  useQuery({
    queryKey: DASH_KEYS.activity,
    queryFn:  () => dashboardService.getClientActivity?.() ?? Promise.resolve({ days: [], counts: [] }),
    refetchInterval: 120_000,
    ...opts,
  })

// ── Composite composable (convenience wrapper used by DashboardView) ─────────

export function useDashboardQuery() {
  const qc = useQueryClient()

  const overview = useOverviewQuery()
  const clients  = useClientsQuery()
  const hunts    = useHuntsQuery()
  const activity = useActivityQuery()

  /** True while any query is in its initial loading state */
  const isLoading = computed(() =>
    overview.isLoading.value ||
    clients.isLoading.value  ||
    hunts.isLoading.value
  )

  /** True if any query has errored */
  const isError = computed(() =>
    overview.isError.value ||
    clients.isError.value  ||
    hunts.isError.value
  )

  /** Trigger a manual refresh of all dashboard queries */
  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  return {
    // raw query objects (expose .data, .isLoading, .error etc.)
    overview,
    clients,
    hunts,
    activity,

    // convenience aggregates
    isLoading,
    isError,

    // helpers
    invalidateAll,
  }
}
