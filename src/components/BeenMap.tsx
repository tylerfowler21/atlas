"use client";

import { useMemo, useState } from "react";
import MapCanvas, { type MapPin } from "@/components/MapCanvas";
import { category as categoryOf, placeIcon } from "@/lib/taxonomy";
import type { PlaceDTO } from "@/lib/types";

export default function BeenMap({ places }: { places: PlaceDTO[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pins = useMemo<MapPin[]>(
    () =>
      places.map((p) => {
        const meta = categoryOf(p.category);
        return { id: p.id, lat: p.lat, lng: p.lng, color: meta.color, icon: placeIcon(p) };
      }),
    [places],
  );

  const selected = places.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="relative h-[60vh] overflow-hidden rounded-xl border border-line">
      <MapCanvas
        pins={pins}
        selectedId={selectedId}
        onSelect={setSelectedId}
        fitToken="been"
      />
      {selected && (
        <div className="card absolute bottom-3 left-3 max-w-[min(20rem,80%)] px-3 py-2 shadow-lg">
          <p className="text-sm font-medium">{selected.name}</p>
          <p className="text-xs text-muted">
            {[selected.city, selected.country].filter(Boolean).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
