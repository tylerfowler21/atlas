/// The bits of MapKit JS that @types/apple-mapkit-js-browser has not caught up
/// with.
///
/// Selectable map features are how the restaurants and museums Apple already
/// draws are made tappable. They ship in the 5.x bundle this app loads —
/// verified against the served file, which defines `selectableMapFeatures` as a
/// read-write map property and `MapFeatureType` with PointOfInterest, Territory
/// and PhysicalFeature — but the published types stop at 5.78.
///
/// Declared here rather than cast at the call site so there is one place to
/// delete when the types catch up, and so the shape is stated once instead of
/// being asserted differently in each place that touches it.
declare namespace mapkit {
  enum MapFeatureType {
    PointOfInterest = "PointOfInterest",
    Territory = "Territory",
    PhysicalFeature = "PhysicalFeature",
  }

  interface Map {
    /// Which of Apple's own map features respond to a tap. Empty by default.
    selectableMapFeatures: MapFeatureType[];
  }
}
