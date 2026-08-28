/// Shared by both map implementations and the component that chooses
/// between them, so neither has to import the other's mapping library.

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  icon: string;
  /// Small number shown on the pin — used for itinerary ordering.
  badge?: string | null;
  /// Drawn faded, for pins that are filtered out but still worth showing.
  muted?: boolean;
};

/// A place Apple already knows about, tapped on the map.
export type SelectedPlace = {
  name: string;
  lat: number;
  lng: number;
  /// One of ours, worked out from Apple's own category for it.
  category: string;
};

export type MapCanvasProps = {
  pins: MapPin[];
  /// [lng, lat] pairs drawn as a dashed connector between itinerary stops.
  route?: [number, number][];
  routeColor?: string;
  /// Journeys between two places — a train, a flight — drawn as solid lines so
  /// they read differently from the dashed order-of-the-day connector.
  legs?: { from: [number, number]; to: [number, number] }[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /// When set, clicking empty map reports where — this is the drop-a-pin flow.
  onMapClick?: (lat: number, lng: number) => void;
  /// When set, the places Apple already labels on the map become tappable, and
  /// tapping one reports it. Apple Maps only: the free basemap draws its own
  /// labels but has no way to say what was underneath a click.
  onPlaceSelect?: (place: SelectedPlace) => void;
  /// Change this string to re-fit the viewport to the current pins.
  fitToken?: string;
  /// Pan to one point without refitting everything. Bump `token` to re-run it.
  focus?: { lat: number; lng: number; zoom?: number; token: number } | null;
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
  /// "auto" uses Apple Maps when this viewer can get a token, falling back to
  /// the free basemap otherwise. "free" never asks — public share pages pass
  /// it so anonymous traffic cannot spend the Apple quota.
  basemap?: "auto" | "free";
};

