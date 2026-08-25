/// Keyword search over a travel-shaped emoji set.
///
/// Deliberately curated rather than pulled from a full Unicode dataset. The
/// standard annotations are literal — 🌊 is "water wave" and nothing more — so
/// searching "waterfall", "hike" or "gondola" against them finds nothing even
/// though good answers exist. The keywords below include the words people
/// actually type about a trip.

type Entry = { emoji: string; keywords: string[] };

const EMOJI: Entry[] = [
  // --- water and landscape ------------------------------------------------
  { emoji: "🌊", keywords: ["wave", "water", "waterfall", "sea", "ocean", "surf", "tide", "swim"] },
  { emoji: "💦", keywords: ["splash", "water", "waterfall", "spray", "droplets", "falls"] },
  { emoji: "⛲", keywords: ["fountain", "water", "waterfall", "square", "plaza"] },
  { emoji: "🏞️", keywords: ["park", "national park", "valley", "waterfall", "river", "nature", "countryside"] },
  { emoji: "🏔️", keywords: ["mountain", "snow", "alps", "peak", "summit", "alpine"] },
  { emoji: "⛰️", keywords: ["mountain", "hill", "peak", "hike", "climb"] },
  { emoji: "🗻", keywords: ["fuji", "mountain", "volcano", "japan"] },
  { emoji: "🌋", keywords: ["volcano", "crater", "lava", "eruption"] },
  { emoji: "🏕️", keywords: ["camp", "camping", "tent", "wild", "outdoors"] },
  { emoji: "🏖️", keywords: ["beach", "sand", "coast", "seaside", "sun", "resort"] },
  { emoji: "🏝️", keywords: ["island", "tropical", "palm", "desert island"] },
  { emoji: "🏜️", keywords: ["desert", "dune", "sand", "cactus", "arid"] },
  { emoji: "🌅", keywords: ["sunrise", "sunset", "dawn", "morning", "view"] },
  { emoji: "🌄", keywords: ["sunrise", "mountains", "dawn", "viewpoint"] },
  { emoji: "🌌", keywords: ["stars", "night", "milky way", "sky", "aurora"] },
  { emoji: "🌲", keywords: ["forest", "tree", "woods", "pine", "trail"] },
  { emoji: "🌴", keywords: ["palm", "tropical", "beach", "island"] },
  { emoji: "🌸", keywords: ["blossom", "cherry", "spring", "sakura", "flower"] },
  { emoji: "🍁", keywords: ["autumn", "fall", "leaf", "maple", "colours"] },
  { emoji: "❄️", keywords: ["snow", "cold", "winter", "ice", "ski"] },
  { emoji: "🧊", keywords: ["ice", "glacier", "frozen", "cold"] },
  { emoji: "🗿", keywords: ["statue", "monument", "easter island", "stone"] },
  { emoji: "🕳️", keywords: ["cave", "hole", "cavern", "gorge", "tunnel"] },

  // --- getting around -----------------------------------------------------
  { emoji: "✈️", keywords: ["plane", "flight", "airport", "fly", "travel", "airplane"] },
  { emoji: "🛫", keywords: ["takeoff", "departure", "flight", "leaving"] },
  { emoji: "🛬", keywords: ["landing", "arrival", "flight", "arriving"] },
  { emoji: "🚂", keywords: ["train", "rail", "railway", "steam", "locomotive"] },
  { emoji: "🚆", keywords: ["train", "rail", "commuter", "metro", "subway"] },
  { emoji: "🚡", keywords: ["cable car", "gondola", "aerial", "lift", "mountain"] },
  { emoji: "🚠", keywords: ["cable car", "gondola", "mountain", "lift", "funicular"] },
  { emoji: "🚞", keywords: ["mountain railway", "train", "funicular", "cog"] },
  { emoji: "🚌", keywords: ["bus", "coach", "transit"] },
  { emoji: "🚗", keywords: ["car", "drive", "road trip", "hire", "rental"] },
  { emoji: "🛵", keywords: ["scooter", "moped", "vespa"] },
  { emoji: "🚲", keywords: ["bike", "bicycle", "cycling", "ride"] },
  { emoji: "🛶", keywords: ["canoe", "kayak", "paddle", "row"] },
  { emoji: "⛵", keywords: ["sail", "boat", "yacht", "sailing"] },
  { emoji: "🛳️", keywords: ["ship", "cruise", "ferry", "boat"] },
  { emoji: "⛴️", keywords: ["ferry", "boat", "crossing"] },
  { emoji: "🚁", keywords: ["helicopter", "chopper", "scenic flight"] },
  { emoji: "🎢", keywords: ["rollercoaster", "theme park", "fair", "ride"] },
  { emoji: "🎡", keywords: ["ferris wheel", "fair", "view", "big wheel"] },
  { emoji: "🧳", keywords: ["luggage", "suitcase", "packing", "bag", "travel"] },
  { emoji: "🗺️", keywords: ["map", "route", "plan", "navigate"] },
  { emoji: "🧭", keywords: ["compass", "direction", "navigate", "explore"] },
  { emoji: "🎫", keywords: ["ticket", "entry", "admission", "booking"] },
  { emoji: "🛂", keywords: ["passport", "border", "immigration", "control"] },

  // --- places to stay -----------------------------------------------------
  { emoji: "🛏️", keywords: ["hotel", "bed", "stay", "sleep", "room", "accommodation"] },
  { emoji: "🏨", keywords: ["hotel", "stay", "accommodation", "lodging"] },
  { emoji: "🏡", keywords: ["house", "cottage", "airbnb", "home", "rental", "chalet"] },
  { emoji: "🏰", keywords: ["castle", "palace", "fortress", "chateau", "fairytale"] },
  { emoji: "🏯", keywords: ["castle", "japan", "pagoda", "japanese"] },
  { emoji: "⛺", keywords: ["tent", "camp", "camping", "glamping"] },
  { emoji: "🏚️", keywords: ["ruins", "abandoned", "derelict", "old house"] },

  // --- landmarks and culture ---------------------------------------------
  { emoji: "🏛️", keywords: ["museum", "gallery", "classical", "monument", "ruins", "temple"] },
  { emoji: "⛪", keywords: ["church", "cathedral", "chapel", "basilica"] },
  { emoji: "🕌", keywords: ["mosque", "islamic", "minaret"] },
  { emoji: "🛕", keywords: ["temple", "hindu", "shrine"] },
  { emoji: "🕍", keywords: ["synagogue", "jewish", "temple"] },
  { emoji: "⛩️", keywords: ["shrine", "torii", "japan", "shinto"] },
  { emoji: "🗼", keywords: ["tower", "tokyo", "landmark", "observation"] },
  { emoji: "🗽", keywords: ["statue of liberty", "new york", "landmark", "statue"] },
  { emoji: "🌉", keywords: ["bridge", "crossing", "night", "landmark"] },
  { emoji: "🎨", keywords: ["art", "gallery", "museum", "painting", "exhibition"] },
  { emoji: "🎭", keywords: ["theatre", "theater", "show", "play", "opera", "drama"] },
  { emoji: "🎼", keywords: ["music", "concert", "opera", "classical"] },
  { emoji: "🎪", keywords: ["circus", "festival", "tent", "show"] },
  { emoji: "📸", keywords: ["photo", "camera", "picture", "viewpoint", "spot"] },
  { emoji: "🎆", keywords: ["fireworks", "festival", "celebration", "new year"] },
  { emoji: "🎉", keywords: ["party", "celebration", "festival", "night out"] },
  { emoji: "🛍️", keywords: ["shopping", "shops", "market", "boutique", "souvenir"] },
  { emoji: "🧺", keywords: ["market", "picnic", "basket", "produce"] },
  { emoji: "📚", keywords: ["bookshop", "library", "books", "reading"] },

  // --- eating -------------------------------------------------------------
  { emoji: "🍽️", keywords: ["restaurant", "dinner", "meal", "eat", "food", "lunch"] },
  { emoji: "🥐", keywords: ["croissant", "bakery", "pastry", "breakfast", "bread", "patisserie"] },
  { emoji: "🥖", keywords: ["bread", "baguette", "bakery", "boulangerie", "france"] },
  { emoji: "🧀", keywords: ["cheese", "fromage", "dairy", "fondue", "raclette"] },
  { emoji: "🍕", keywords: ["pizza", "italian", "slice"] },
  { emoji: "🍝", keywords: ["pasta", "italian", "spaghetti", "trattoria"] },
  { emoji: "🍜", keywords: ["ramen", "noodles", "soup", "pho", "asian"] },
  { emoji: "🍣", keywords: ["sushi", "japanese", "sashimi", "fish"] },
  { emoji: "🍛", keywords: ["curry", "rice", "indian", "thai"] },
  { emoji: "🌮", keywords: ["taco", "mexican", "street food"] },
  { emoji: "🥙", keywords: ["kebab", "wrap", "falafel", "pita", "street food"] },
  { emoji: "🍔", keywords: ["burger", "diner", "fast food"] },
  { emoji: "🥩", keywords: ["steak", "meat", "grill", "barbecue", "asado"] },
  { emoji: "🐟", keywords: ["fish", "seafood", "fishing"] },
  { emoji: "🦐", keywords: ["seafood", "prawn", "shrimp", "shellfish"] },
  { emoji: "🦞", keywords: ["lobster", "seafood", "shellfish"] },
  { emoji: "🥗", keywords: ["salad", "healthy", "vegetarian", "greens"] },
  { emoji: "🍲", keywords: ["stew", "hotpot", "soup", "pot"] },
  { emoji: "🥟", keywords: ["dumpling", "dim sum", "gyoza", "chinese"] },
  { emoji: "🧁", keywords: ["cake", "cupcake", "dessert", "bakery", "sweet"] },
  { emoji: "🍰", keywords: ["cake", "dessert", "patisserie", "sweet", "torte"] },
  { emoji: "🍦", keywords: ["ice cream", "gelato", "dessert", "sweet"] },
  { emoji: "🍫", keywords: ["chocolate", "sweet", "swiss", "confectionery"] },
  { emoji: "🥞", keywords: ["pancakes", "breakfast", "brunch"] },
  { emoji: "🥨", keywords: ["pretzel", "german", "bakery", "beer garden"] },
  { emoji: "🍯", keywords: ["honey", "local produce", "market"] },
  { emoji: "🍎", keywords: ["fruit", "apple", "orchard", "market"] },

  // --- drinking -----------------------------------------------------------
  { emoji: "☕", keywords: ["coffee", "cafe", "espresso", "breakfast", "flat white"] },
  { emoji: "🍵", keywords: ["tea", "matcha", "teahouse", "green tea"] },
  { emoji: "🍺", keywords: ["beer", "pub", "brewery", "pint", "bar"] },
  { emoji: "🍻", keywords: ["beer", "cheers", "pub", "drinks", "bar"] },
  { emoji: "🍷", keywords: ["wine", "vineyard", "winery", "red wine", "tasting"] },
  { emoji: "🥂", keywords: ["champagne", "celebration", "toast", "prosecco"] },
  { emoji: "🍸", keywords: ["cocktail", "bar", "martini", "drinks"] },
  { emoji: "🍹", keywords: ["cocktail", "tropical", "beach bar", "drinks"] },
  { emoji: "🥃", keywords: ["whisky", "whiskey", "bourbon", "distillery", "nightcap"] },
  { emoji: "🧃", keywords: ["juice", "smoothie", "drink"] },
  { emoji: "🍶", keywords: ["sake", "japanese", "drink"] },

  // --- doing things -------------------------------------------------------
  { emoji: "🥾", keywords: ["hike", "hiking", "walk", "trail", "boots", "trek"] },
  { emoji: "🧗", keywords: ["climb", "climbing", "via ferrata", "bouldering"] },
  { emoji: "⛷️", keywords: ["ski", "skiing", "snow", "slope", "winter"] },
  { emoji: "🏂", keywords: ["snowboard", "snow", "winter", "slope"] },
  { emoji: "🏊", keywords: ["swim", "swimming", "pool", "lake", "sea"] },
  { emoji: "🤿", keywords: ["dive", "diving", "snorkel", "scuba", "reef"] },
  { emoji: "🏄", keywords: ["surf", "surfing", "waves", "board"] },
  { emoji: "🚣", keywords: ["row", "rowing", "boat", "paddle"] },
  { emoji: "🎣", keywords: ["fishing", "angling", "lake", "river"] },
  { emoji: "⚽", keywords: ["football", "soccer", "match", "stadium"] },
  { emoji: "🎿", keywords: ["ski", "skiing", "winter", "snow"] },
  { emoji: "🧘", keywords: ["yoga", "spa", "retreat", "meditation", "wellness"] },
  { emoji: "♨️", keywords: ["hot spring", "onsen", "spa", "thermal", "bath"] },
  { emoji: "💆", keywords: ["spa", "massage", "wellness", "hammam"] },
  { emoji: "🎰", keywords: ["casino", "gambling", "vegas"] },
  { emoji: "🎳", keywords: ["bowling", "games", "night out"] },
  { emoji: "🎤", keywords: ["karaoke", "concert", "gig", "singing", "live music"] },
  { emoji: "🕺", keywords: ["dancing", "club", "nightlife", "night out"] },
  { emoji: "🛌", keywords: ["rest", "sleep", "nap", "hotel"] },

  // --- creatures ----------------------------------------------------------
  { emoji: "🐧", keywords: ["penguin", "zoo", "antarctic", "wildlife"] },
  { emoji: "🐘", keywords: ["elephant", "safari", "wildlife", "zoo"] },
  { emoji: "🦁", keywords: ["lion", "safari", "wildlife", "zoo"] },
  { emoji: "🐄", keywords: ["cow", "cattle", "farm", "alpine", "dairy"] },
  { emoji: "🐐", keywords: ["goat", "mountain", "farm"] },
  { emoji: "🐕", keywords: ["dog", "walk", "pet"] },
  { emoji: "🐈", keywords: ["cat", "pet"] },
  { emoji: "🐬", keywords: ["dolphin", "sea", "wildlife", "boat trip"] },
  { emoji: "🐳", keywords: ["whale", "whale watching", "sea", "wildlife"] },
  { emoji: "🦜", keywords: ["parrot", "bird", "tropical", "wildlife"] },
  { emoji: "🦅", keywords: ["eagle", "bird", "wildlife", "raptor"] },
  { emoji: "🐝", keywords: ["bee", "honey", "nature"] },
  { emoji: "🦌", keywords: ["deer", "wildlife", "forest"] },
  { emoji: "🐻", keywords: ["bear", "wildlife", "forest"] },

  // --- practical ----------------------------------------------------------
  { emoji: "📍", keywords: ["pin", "place", "location", "spot", "marker"] },
  { emoji: "⭐", keywords: ["favourite", "favorite", "star", "highlight", "best"] },
  { emoji: "❤️", keywords: ["love", "favourite", "favorite", "heart", "loved"] },
  { emoji: "🔥", keywords: ["hot", "amazing", "must", "highlight"] },
  { emoji: "💎", keywords: ["gem", "hidden gem", "special", "find"] },
  { emoji: "🎁", keywords: ["gift", "souvenir", "present", "shopping"] },
  { emoji: "💰", keywords: ["expensive", "money", "budget", "cost"] },
  { emoji: "🏦", keywords: ["bank", "atm", "money", "exchange"] },
  { emoji: "🏥", keywords: ["hospital", "doctor", "pharmacy", "medical"] },
  { emoji: "🚻", keywords: ["toilets", "restroom", "bathroom", "wc"] },
  { emoji: "🅿️", keywords: ["parking", "car park", "garage"] },
  { emoji: "⛽", keywords: ["fuel", "petrol", "gas", "station"] },
  { emoji: "🧺", keywords: ["laundry", "washing"] },
  { emoji: "☀️", keywords: ["sun", "sunny", "hot", "weather", "clear"] },
  { emoji: "🌧️", keywords: ["rain", "wet", "weather", "storm"] },
  { emoji: "🌙", keywords: ["night", "evening", "moon", "late"] },
];

export type EmojiHit = { emoji: string; keyword: string };

/// Ranked: an exact keyword first, then keywords starting with the query, then
/// anything containing it. Ties keep the order above, which is roughly
/// most-useful-first within each theme.
export function searchEmoji(query: string, limit = 24): EmojiHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exact: EmojiHit[] = [];
  const prefix: EmojiHit[] = [];
  const contains: EmojiHit[] = [];

  for (const entry of EMOJI) {
    let best: { rank: 0 | 1 | 2; keyword: string } | null = null;

    for (const keyword of entry.keywords) {
      const rank = keyword === q ? 0 : keyword.startsWith(q) ? 1 : keyword.includes(q) ? 2 : null;
      if (rank === null) continue;
      if (!best || rank < best.rank) best = { rank, keyword };
    }

    if (!best) continue;
    const hit = { emoji: entry.emoji, keyword: best.keyword };
    if (best.rank === 0) exact.push(hit);
    else if (best.rank === 1) prefix.push(hit);
    else contains.push(hit);
  }

  return [...exact, ...prefix, ...contains].slice(0, limit);
}
