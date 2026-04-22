import { supabase } from './supabase';

export interface ScanLogInput {
  batchId: string;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  country?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  alertTriggered?: boolean;
  alertReason?: string | null;
}

export interface PreviousScan {
  city: string;
  scanned_at: string;
}

export interface ScanAnalytics {
  scanCount: number;
  previousScan: PreviousScan | null;
}

export async function logScan(input: ScanLogInput) {
  const payload = {
    batch_id: input.batchId.trim().toUpperCase(),
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    city: input.city ?? null,
    country: input.country ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    alert_triggered: input.alertTriggered ?? false,
    alert_reason: input.alertReason ?? null,
  };

  const { data, error } = await supabase
    .from('scan_logs')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getBatchLimit(batchId: string) {
  const { data, error } = await supabase
    .from('batch_limits')
    .select('*')
    .eq('batch_id', batchId.trim().toUpperCase())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getScanAnalytics(batchId: string): Promise<ScanAnalytics> {
  const normalizedBatchId = batchId.trim().toUpperCase();

  const { count, error: countError } = await supabase
    .from('scan_logs')
    .select('*', { count: 'exact', head: true })
    .eq('batch_id', normalizedBatchId);

  if (countError) {
    throw countError;
  }

  const { data: latestScans, error: latestError } = await supabase
    .from('scan_logs')
    .select('city, scanned_at')
    .eq('batch_id', normalizedBatchId)
    .order('scanned_at', { ascending: false })
    .limit(1);

  if (latestError) {
    throw latestError;
  }

  const latest = latestScans?.[0] as { city: string | null; scanned_at: string } | undefined;

  return {
    scanCount: count ?? 0,
    previousScan:
      latest?.city && latest.scanned_at
        ? {
            city: latest.city,
            scanned_at: latest.scanned_at,
          }
        : null,
  };
}
