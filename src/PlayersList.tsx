import React from "react";
import type { GameInfo } from "./fileParser.worker";
import steamImg from "./images/cropped_steam_image.png";
import { CHEATERS_LANID } from "./CHEATERS_LANID";

const NATION_NAMES: string[] = [
  "Random",
  "Austria",
  "France",
  "England",
  "Spain",
  "Russia",
  "Ukraine",
  "Poland",
  "Sweden",
  "Prussia",
  "Venice",
  "Turkey",
  "Algeria",
  "Netherlands",
  "Denmark",
  "Portugal",
  "Piedmont",
  "Saxony",
  "Bavaria",
  "Hungary",
  "Switzerland",
  "Scotland",
  "SPECTATOR",
];

const COLORS_RGB: string[] = [
  "252, 3, 3",
  "11, 3, 252",
  "3, 244, 252",
  "175, 0, 250",
  "245, 113, 12",
  "47, 217, 4",
  "252, 250, 250",
  "247, 65, 250",
  "238, 255, 0",
  "56, 35, 176",
  "145, 255, 149",
  "99, 53, 7",
];

const nationName = (cid: number | undefined): string => {
  if (cid === undefined || Number.isNaN(cid)) return "";
  if (cid === -2) return "SPECTATOR";
  if (cid === 24) return "Random";
  if (cid >= 0 && cid < NATION_NAMES.length) return NATION_NAMES[cid];
  return "";
};

// color chip styling moved to CSS classes in App.css

export type PlayersListProps = {
  data?: GameInfo | null;
  lanidNames: Record<string | number, Set<string>>;
};

export const PlayersList: React.FC<PlayersListProps> = ({ data, lanidNames }) => {
  const players = (data?.players ?? []).filter((p) => {
    const bexists = (p as any)?.bexists === true;
    const lanidZero = p.lanid === 0;
    const nameStr = (p as any)?.name ? String((p as any).name) : "";
    const isPlaceholderName = nameStr.trim().toLowerCase() === "name";
    // Hide obvious empty slots like: name (id: N) lanid 0 team 0 color X
    const isEmptySlot = lanidZero && isPlaceholderName;
    return bexists && !isEmptySlot;
  });

  if (!players.length) return <>—</>;

  return (
    <ul className="players-list">
      {players.map((p, i) => (
        <li key={`${p.id}-${p.lanid}-${p.color}-${i}`}>
          {p.name} (id: {p.id})
          {(() => {
            const sic = (p as any)?.sic as number | string | undefined;
            const sicStr = sic != null ? String(sic) : "0";
            if (sicStr !== "0") {
              try {
                const A = 76561197960265728n;
                const url = `https://steamcommunity.com/profiles/${(A + BigInt(sicStr)).toString()}`;
                const snc = (p as any)?.snc as string | undefined;
                return (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={snc ? `Open Steam profile: ${snc}` : "Open Steam profile"}
                    className="steam-link"
                  >
                    <img src={steamImg} alt="Steam" className="steam-icon" />
                    {snc ? <span>{snc}</span> : null}
                  </a>
                );
              } catch {
                return null;
              }
            }
            return null;
          })()} {" "}lanid {" "}
          {(() => {
            const namesSet = lanidNames[p.lanid] || new Set<string>();
            const namesArr = Array.from(namesSet);
            const hasMultiple = namesArr.length > 1;
            const otherNames = namesArr.filter((n) => n !== p.name);
            return (
              <span className="lanid-badge-wrapper">
                <span className={`lanid-badge${hasMultiple ? " lanid-badge--multi" : ""}`}>{p.lanid}</span>
                {CHEATERS_LANID.includes(p.lanid) && (
                  <span className="cheater-badge" title="Reported cheater">🚨 cheater</span>
                )}
                {hasMultiple && (
                  <span className="lanid-tooltip" role="tooltip">
                    <div className="lanid-tooltip-title">Other names</div>
                    <ul className="lanid-tooltip-list">
                      {otherNames.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </span>
                )}
              </span>
            );
          })()}
          {(() => {
            // Render extra Steam links (si1/si2/si3) if present, excluding duplicate of primary sic
            const extras: Array<{ id?: number | string; name?: string }> = [
              { id: (p as any)?.si1, name: (p as any)?.sn1 },
              { id: (p as any)?.si2, name: (p as any)?.sn2 },
              { id: (p as any)?.si3, name: (p as any)?.sn3 },
            ];
            const primary = (p as any)?.sic as number | string | undefined;
            const primaryStr = primary != null ? String(primary) : "0";
            const links = extras
              .filter((e) => e.id != null && String(e.id) !== "0" && String(e.id) !== primaryStr)
              .map((e, idx) => {
                try {
                  const A = 76561197960265728n;
                  const url = `https://steamcommunity.com/profiles/${(A + BigInt(String(e.id))).toString()}`;
                  const label = e.name ? String(e.name) : undefined;
                  return (
                    <a
                      key={`ex-${idx}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={label ? `Open Steam profile: ${label}` : "Open Steam profile"}
                      className="steam-link steam-link--extra"
                    >
                      <img src={steamImg} alt="Steam" className="steam-icon" />
                      {label ? <span>{label}</span> : null}
                    </a>
                  );
                } catch {
                  return null;
                }
              })
              .filter(Boolean);
            return links.length ? (
              <span className="steam-extras" title="Extra Steam links">
                <span className="steam-extras__pill">extra</span>
                {links}
              </span>
            ) : null;
          })()}
          {" "}team {p.team} color {p.color}
          <span
            aria-label="color"
            title={`rgb(${COLORS_RGB[p.color] ?? ""})`}
            className={`color-chip color-${p.color}`}
          />
        </li>
      ))}
    </ul>
  );
};
