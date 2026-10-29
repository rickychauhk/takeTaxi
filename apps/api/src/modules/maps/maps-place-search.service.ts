import { Injectable } from '@nestjs/common';
import { expandHkPlaceSearchQueries, rankPlaceLabelSpecificity } from './hk-place-query.util';

export type PlaceSearchItem = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

@Injectable()
export class MapsPlaceSearchService {
  private apiKey(): string | null {
    return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
  }

  async search(
    query: string,
    near?: { lat: number; lng: number },
  ): Promise<{ items: PlaceSearchItem[] }> {
    const key = this.apiKey();
    const trimmed = query.trim();
    if (!key || trimmed.length < 2) return { items: [] };

    const queries = expandHkPlaceSearchQueries(trimmed);
    const merged = new Map<string, PlaceSearchItem>();

    const add = (item: PlaceSearchItem | null) => {
      if (!item) return;
      const k = `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`;
      const prev = merged.get(k);
      if (!prev || rankPlaceLabelSpecificity(trimmed, item.label) > rankPlaceLabelSpecificity(trimmed, prev.label)) {
        merged.set(k, item);
      }
    };

    for (const q of queries) {
      for (const item of await this.autocomplete(q, key, near)) add(item);
      for (const item of await this.textSearch(q, key, near)) add(item);
      for (const item of await this.findPlaceFromText(q, key, near)) add(item);
      for (const item of await this.geocode(q, key)) add(item);
      if (merged.size >= 12) break;
    }

    const items = [...merged.values()]
      .sort((a, b) => rankPlaceLabelSpecificity(trimmed, b.label) - rankPlaceLabelSpecificity(trimmed, a.label))
      .slice(0, 12);

    return { items };
  }

  /** 司機出貨：地址文字 → 首個 geocode 結果（限香港） */
  async geocodeAddressHongKong(query: string): Promise<PlaceSearchItem | null> {
    const key = this.apiKey();
    const trimmed = query.trim();
    if (!key || trimmed.length < 2) return null;
    const items = await this.geocode(trimmed, key);
    return items[0] ?? null;
  }

  private async fetchGoogle<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  private locationBias(near?: { lat: number; lng: number }): string {
    if (!near) return 'circle:80000@22.3193,114.1694';
    return `circle:80000@${near.lat},${near.lng}`;
  }

  private async autocomplete(
    input: string,
    key: string,
    near?: { lat: number; lng: number },
  ): Promise<PlaceSearchItem[]> {
    const params = new URLSearchParams({
      input,
      components: 'country:hk',
      language: 'zh-HK',
      key,
    });
    if (near) {
      params.set('location', `${near.lat},${near.lng}`);
      params.set('radius', '80000');
    }
    const data = await this.fetchGoogle<{
      status?: string;
      predictions?: { place_id?: string; description?: string }[];
    }>(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
    if (data?.status !== 'OK' || !data.predictions?.length) return [];

    const out: PlaceSearchItem[] = [];
    for (const p of data.predictions.slice(0, 6)) {
      if (!p.place_id) continue;
      const d = await this.placeDetails(p.place_id, key);
      if (d) {
        out.push({
          id: `ac-${p.place_id}`,
          latitude: d.lat,
          longitude: d.lng,
          label: d.label || p.description?.trim() || input,
        });
      }
    }
    return out;
  }

  private async placeDetails(
    placeId: string,
    key: string,
  ): Promise<{ lat: number; lng: number; label: string } | null> {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'geometry,formatted_address,name',
      language: 'zh-HK',
      region: 'hk',
      key,
    });
    const data = await this.fetchGoogle<{
      status?: string;
      result?: {
        name?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      };
    }>(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
    const loc = data?.result?.geometry?.location;
    if (data?.status !== 'OK' || loc?.lat == null || loc?.lng == null) return null;
    const label = data.result?.name?.trim() || data.result?.formatted_address?.trim() || '';
    if (!label) return null;
    return { lat: loc.lat, lng: loc.lng, label };
  }

  private async textSearch(
    query: string,
    key: string,
    near?: { lat: number; lng: number },
  ): Promise<PlaceSearchItem[]> {
    const params = new URLSearchParams({
      query: query.includes('香港') ? query : `${query} 香港`,
      region: 'hk',
      language: 'zh-HK',
      key,
    });
    if (near) params.set('location', `${near.lat},${near.lng}`);
    const data = await this.fetchGoogle<{
      status?: string;
      results?: {
        name?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      }[];
    }>(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
    if (data?.status !== 'OK' || !data.results?.length) return [];
    return data.results.slice(0, 6).flatMap((r, i) => {
      const lat = r.geometry?.location?.lat;
      const lng = r.geometry?.location?.lng;
      const label = r.name?.trim() || r.formatted_address?.trim();
      if (lat == null || lng == null || !label) return [];
      return [{ id: `ts-${i}-${lat}`, latitude: lat, longitude: lng, label }];
    });
  }

  private async findPlaceFromText(
    input: string,
    key: string,
    near?: { lat: number; lng: number },
  ): Promise<PlaceSearchItem[]> {
    const params = new URLSearchParams({
      input: input.includes('香港') ? input : `${input} 香港`,
      inputtype: 'textquery',
      fields: 'formatted_address,name,geometry',
      language: 'zh-HK',
      locationbias: this.locationBias(near),
      key,
    });
    const data = await this.fetchGoogle<{
      status?: string;
      candidates?: {
        name?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      }[];
    }>(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`);
    if (data?.status !== 'OK' || !data.candidates?.length) return [];
    return data.candidates.slice(0, 4).flatMap((c, i) => {
      const lat = c.geometry?.location?.lat;
      const lng = c.geometry?.location?.lng;
      const label = c.name?.trim() || c.formatted_address?.trim();
      if (lat == null || lng == null || !label) return [];
      return [{ id: `fp-${i}-${lat}`, latitude: lat, longitude: lng, label }];
    });
  }

  private async geocode(query: string, key: string): Promise<PlaceSearchItem[]> {
    const params = new URLSearchParams({
      address: query.includes('香港') ? query : `${query}, 香港`,
      region: 'hk',
      language: 'zh-HK',
      key,
    });
    const data = await this.fetchGoogle<{
      status?: string;
      results?: {
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      }[];
    }>(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    if (data?.status !== 'OK' || !data.results?.length) return [];
    return data.results.slice(0, 5).flatMap((r, i) => {
      const lat = r.geometry?.location?.lat;
      const lng = r.geometry?.location?.lng;
      const label = r.formatted_address?.trim();
      if (lat == null || lng == null || !label) return [];
      return [{ id: `geo-${i}-${lat}`, latitude: lat, longitude: lng, label }];
    });
  }
}
