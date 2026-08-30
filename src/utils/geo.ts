import type { NearestStoreMatch, StorePOI } from '../types';

/** 地球平均半徑（公尺） */
const EARTH_RADIUS_M = 6_371_000;

/** 預設比對半徑：100 公尺內才算「人在店裡」 */
export const DEFAULT_MATCH_RADIUS_M = 100;

/** 找不到門市時的預設通路 */
export const GENERAL_STORE: StorePOI = {
  uid: 'general',
  id: 'general',
  name: '一般通路',
  category: 'general',
};

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Haversine 公式：計算兩點球面距離（公尺）
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * 回傳最近的門市與距離；超出半徑則回傳 null。
 */
export function findNearestStoreWithDistance(
  userLat: number,
  userLon: number,
  stores: StorePOI[],
  radiusMeters: number = DEFAULT_MATCH_RADIUS_M,
): NearestStoreMatch | null {
  let best: NearestStoreMatch | null = null;

  for (const store of stores) {
    if (typeof store.latitude !== 'number' || typeof store.longitude !== 'number') {
      continue;
    }
    const distanceMeters = haversineDistance(
      userLat,
      userLon,
      store.latitude,
      store.longitude,
    );
    if (distanceMeters > radiusMeters) continue;
    if (!best || distanceMeters < best.distanceMeters) {
      best = { store, distanceMeters };
    }
  }

  return best;
}

/**
 * 規格函式：取得最近店家。
 * 100 公尺內無匹配時回傳 null，呼叫端可 fallback 為「一般通路」。
 */
export function getNearestStore(
  userLat: number,
  userLon: number,
  stores: StorePOI[],
  radiusMeters: number = DEFAULT_MATCH_RADIUS_M,
): StorePOI | null {
  return findNearestStoreWithDistance(userLat, userLon, stores, radiusMeters)?.store ?? null;
}

/**
 * 依距離排序，取出附近 N 間門市（給「不是這間？」手動修正用）。
 */
export function getNearbyStores(
  userLat: number,
  userLon: number,
  stores: StorePOI[],
  limit = 6,
  radiusMeters = 800,
): NearestStoreMatch[] {
  return stores
    .filter(
      (s): s is StorePOI & { latitude: number; longitude: number } =>
        typeof s.latitude === 'number' && typeof s.longitude === 'number',
    )
    .map((store) => ({
      store,
      distanceMeters: haversineDistance(userLat, userLon, store.latitude, store.longitude),
    }))
    .filter((m) => m.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

/** 距離文字：120 公尺 / 1.4 公里 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} 公尺`;
  return `${(meters / 1000).toFixed(1)} 公里`;
}

/**
 * 包裝 Geolocation API 成 Promise。
 * iOS Safari 需在 HTTPS（或 localhost）下才會回傳座標。
 */
export function requestPosition(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('這台裝置沒有定位功能'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}
