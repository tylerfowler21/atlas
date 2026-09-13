/// Mirrored from the website's src/lib/regions.ts — edit that copy and run
/// `npm run sync:mirror`.
export const REGIONS = [
  // Seven hues that stay apart at pin size, and clear 3:1 on the pale card and
  // on Evergreen 900 both — the bar the trip palette was already tuned to.
  // Neighbours on the map are deliberately not neighbours on the wheel: Africa
  // and the Middle East touch, so orange and purple rather than orange and
  // gold.
  { id: "europe", label: "Europe", color: "#3C7FB0" },
  { id: "asia", label: "Asia", color: "#D65A4A" },
  { id: "middle-east", label: "Middle East", color: "#9465A7" },
  { id: "africa", label: "Africa", color: "#F76715" },
  { id: "north-america", label: "North America", color: "#B8831F" },
  { id: "latin-america", label: "Latin America", color: "#3E8E5E" },
  { id: "oceania", label: "Oceania", color: "#2F8C8C" },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

const BY_ID = new Map(REGIONS.map((r) => [r.id as string, r]));

/// ISO 3166-1 alpha-2, lowercased.
///
/// Egypt sits in Africa and Türkiye in the Middle East, which is where each
/// one's land is; Cyprus goes to Europe, which is where its trips come from.
/// Mexico and the Caribbean are Latin America rather than North America, since
/// "North America" meaning Cancún is a surprise to everybody.
const COUNTRIES: Record<RegionId, string[]> = {
  europe: [
    "ad","al","at","ax","ba","be","bg","by","ch","cy","cz","de","dk","ee","es",
    "fi","fo","fr","gb","ge","gg","gi","gr","hr","hu","ie","im","is","it","je",
    "li","lt","lu","lv","mc","md","me","mk","mt","nl","no","pl","pt","ro","rs",
    "ru","se","si","sk","sm","ua","va","xk",
  ],
  asia: [
    "af","bd","bn","bt","cn","hk","id","in","jp","kg","kh","kp","kr","kz","la",
    "lk","mm","mn","mo","mv","my","np","ph","pk","sg","tj","tl","tm","tw","th",
    "uz","vn",
  ],
  "middle-east": [
    "ae","am","az","bh","il","iq","ir","jo","kw","lb","om","ps","qa","sa","sy",
    "tr","ye",
  ],
  africa: [
    "ao","bf","bi","bj","bw","cd","cf","cg","ci","cm","cv","dj","dz","eg","eh",
    "er","et","ga","gh","gm","gn","gq","gw","ke","km","lr","ls","ly","ma","mg",
    "ml","mr","mu","mw","mz","na","ne","ng","re","rw","sc","sd","sl","sn","so",
    "ss","st","sz","td","tg","tn","tz","ug","yt","za","zm","zw",
  ],
  "north-america": ["bm","ca","gl","pm","us"],
  "latin-america": [
    "ag","ai","ar","aw","bb","bl","bo","br","bq","bs","bz","cl","co","cr","cu",
    "cw","dm","do","ec","fk","gd","gf","gp","gt","gy","hn","ht","jm","kn","ky",
    "lc","mf","mq","ms","mx","ni","pa","pe","pr","py","sr","sv","sx","tc","tt",
    "uy","vc","ve","vg","vi",
  ],
  oceania: [
    "as","au","ck","fj","fm","gu","ki","mh","mp","nc","nf","nr","nu","nz","pf",
    "pg","pn","pw","sb","tk","to","tv","vu","ws",
  ],
};

const REGION_BY_COUNTRY = new Map<string, RegionId>(
  Object.entries(COUNTRIES).flatMap(([region, codes]) =>
    codes.map((code) => [code, region as RegionId] as const),
  ),
);

/// Which region a country is in, or null for one this does not know.
///
/// Null on purpose rather than a guess. A trip whose country is not in the
/// list keeps the colour it was given, which is a better answer than colouring
/// Antarctica as Africa because the table had to say something.
export function regionOfCountry(code: string | null | undefined): RegionId | null {
  if (!code) return null;
  return REGION_BY_COUNTRY.get(code.trim().toLowerCase()) ?? null;
}

export function regionColor(id: RegionId | null): string | null {
  return id ? (BY_ID.get(id)?.color ?? null) : null;
}

export function regionLabel(id: RegionId | null): string | null {
  return id ? (BY_ID.get(id)?.label ?? null) : null;
}

const BY_COLOR = new Map(REGIONS.map((r) => [r.color.toLowerCase(), r]));

/// Which region a trip colour stands for, or null for a colour that is not one
/// of them.
///
/// Every colour a trip can be given by where it goes is also one somebody can
/// pick by hand, which is what makes the swatches nameable: a row of seven
/// circles says nothing, and "Europe · Asia · Middle East" says what the list
/// of trips has been doing all along.
export function regionOfColor(color: string | null | undefined): RegionId | null {
  if (!color) return null;
  return BY_COLOR.get(color.trim().toLowerCase())?.id ?? null;
}
