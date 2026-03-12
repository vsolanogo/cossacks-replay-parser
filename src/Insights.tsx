import React, { useMemo, useState } from "react";
import { nationCodes } from "./nation_codes";

const flagsGlob = import.meta.glob("./images/flags/*.png", { eager: true, import: "default" }) as Record<string, string>;

const getFlagUrl = (nationName: string | undefined) => {
  if (!nationName) return undefined;
  const path = `./images/flags/${nationName}.png`;
  return flagsGlob[path];
};

type ProcessedPlayer = {
  original: any;
  name: string;
  id: number;
  lanid: number;
  color: number;
  team: number;
  cid?: number;
  steamId?: string | number | undefined;
  steamUrl?: string | undefined;
  steamName?: string;
  extraSteamLinks: Array<{
    id: string | number;
    name?: string;
    url: string;
  }>;
};

// Extracted from App.tsx since we can't easily import the type without circular deps or restructuring right now
type ResultRow = {
  data?: { players?: any[] } | null;
  validPlayers: ProcessedPlayer[];
};

export const Insights2v2: React.FC<{ results: ResultRow[] }> = ({ results }) => {
  const stats = useMemo(() => {
    let valid2v2Matches = 0;
    const nationCounts: Record<number, number> = {};
    const opponentCounts: Record<number, Record<number, number>> = {};
    const playerMatchCounts: Record<string, { count: number; name: string; steamUrl?: string | undefined }> = {};
    // Top player allies/enemies tracking will be computed in a second pass 
    // or we can store all teams/matches and process later.
    const validMatchesData: Array<{ teamA: ProcessedPlayer[]; teamB: ProcessedPlayer[] }> = [];

    const ALL_NON_RANDOM_NATIONS = Object.keys(nationCodes)
      .map(Number)
      .filter((n) => n !== 24); // Exclude Random

    results.forEach((row) => {
      const players = row.validPlayers;
      if (!players) return;
      
      // Filter out spectators and randoms
      const activePlayers = players.filter(
        (p) => p.cid !== undefined && p.cid !== 24 && p.team !== 255 // Assuming 255 might be spectator, but we mainly group by team. Realistically just checking they have a team.
      );

      // Must be exactly 4 active players
      if (activePlayers.length !== 4) return;

      // Group by team
      const teams = activePlayers.reduce((acc, player) => {
        const t = player.team;
        if (!acc[t]) acc[t] = [];
        acc[t]!.push(player);
        return acc;
      }, {} as Record<number, ProcessedPlayer[]>);

      const teamIds = Object.keys(teams).map(Number);
      
      // Must be exactly 2 teams, and each team must have exactly 2 players
      if (teamIds.length !== 2) return;
      if (teams[teamIds[0]!]!.length !== 2 || teams[teamIds[1]!]!.length !== 2) return;

      valid2v2Matches++;

      const teamA = teams[teamIds[0]!]!;
      const teamB = teams[teamIds[1]!]!;

      validMatchesData.push({ teamA, teamB });

      // Record player appearances to find the most popular player
      activePlayers.forEach((p) => {
        const id = String(p.lanid);
        if (!playerMatchCounts[id]) {
          playerMatchCounts[id] = { count: 0, name: p.name || `LAN ID: ${p.lanid}` };
          if (p.steamUrl) playerMatchCounts[id]!.steamUrl = p.steamUrl;
        }
        playerMatchCounts[id]!.count++;
      });

      // Record picks
      activePlayers.forEach((p) => {
        const cid = p.cid!;
        nationCounts[cid] = (nationCounts[cid] || 0) + 1;
        if (!opponentCounts[cid]) opponentCounts[cid] = {};
      });

      // Record opponents
      teamA.forEach((pA) => {
        const cidA = pA.cid!;
        teamB.forEach((pB) => {
          const cidB = pB.cid!;
          opponentCounts[cidA]![cidB] = (opponentCounts[cidA]![cidB] || 0) + 1;
          // It's symmetric, but we iterate both so A records B, and B records A below
        });
      });
      teamB.forEach((pB) => {
        const cidB = pB.cid!;
        teamA.forEach((pA) => {
          const cidA = pA.cid!;
          opponentCounts[cidB]![cidA] = (opponentCounts[cidB]![cidA] || 0) + 1;
        });
      });
    });

    if (valid2v2Matches === 0) return null;

    let mostPopularPlayerId: string | null = null;
    let mostPopularPlayerName = "";
    let mostPopularPlayerSteamUrl: string | undefined = undefined;
    let maxPlayerMatches = 0;

    Object.entries(playerMatchCounts).forEach(([id, data]) => {
      if (data.count > maxPlayerMatches) {
        maxPlayerMatches = data.count;
        mostPopularPlayerId = id;
        mostPopularPlayerName = data.name;
        mostPopularPlayerSteamUrl = data.steamUrl;
      }
    });

    const allyCounts: Record<string, { count: number; name: string; steamUrl?: string | undefined; lanid: number }> = {};
    const enemyCounts: Record<string, { count: number; name: string; steamUrl?: string | undefined; lanid: number }> = {};

    if (mostPopularPlayerId) {
      validMatchesData.forEach(({ teamA, teamB }) => {
        const inTeamA = teamA.some((p) => String(p.lanid) === mostPopularPlayerId);
        const inTeamB = teamB.some((p) => String(p.lanid) === mostPopularPlayerId);

        if (inTeamA || inTeamB) {
          const myTeam = inTeamA ? teamA : teamB;
          const enemyTeam = inTeamA ? teamB : teamA;

          myTeam.forEach((p) => {
            const id = String(p.lanid);
            if (id !== mostPopularPlayerId) {
              if (!allyCounts[id]) {
                allyCounts[id] = { count: 0, name: p.name || `LAN ID: ${p.lanid}`, lanid: p.lanid };
                if (p.steamUrl) allyCounts[id].steamUrl = p.steamUrl;
              }
              allyCounts[id]!.count++;
            }
          });

          enemyTeam.forEach((p) => {
            const id = String(p.lanid);
            if (!enemyCounts[id]) {
              enemyCounts[id] = { count: 0, name: p.name || `LAN ID: ${p.lanid}`, lanid: p.lanid };
              if (p.steamUrl) enemyCounts[id].steamUrl = p.steamUrl;
            }
            enemyCounts[id]!.count++;
          });
        }
      });
    }

    const topAllies = Object.values(allyCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
      
    const topEnemies = Object.values(enemyCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // 1) Top 5 most popular
    const sortedNations = Object.entries(nationCounts)
      .map(([cidStr, count]) => ({ cid: Number(cidStr), count }))
      .sort((a, b) => b.count - a.count);

    const mostPopular = sortedNations.slice(0, 5);

    // 2) Top 5 least popular (nations that were picked at least once, or you can include 0 picks)
    // To be accurate, we should include nations with 0 picks:
    const allNationsPopularity = ALL_NON_RANDOM_NATIONS.map((cid) => ({
      cid,
      count: nationCounts[cid] || 0,
    })).sort((a, b) => a.count - b.count);
    
    const leastPopular = allNationsPopularity.slice(0, 5);

    // 3 & 4) Opponent stats per nation
    const opponentStats = ALL_NON_RANDOM_NATIONS.map((cid) => {
      const oppMap = opponentCounts[cid] || {};
      const oppList = ALL_NON_RANDOM_NATIONS.filter((n) => n !== cid).map((oppCid) => ({
        cid: oppCid,
        count: oppMap[oppCid] || 0,
      }));

      oppList.sort((a, b) => b.count - a.count);
      const mostFrequent = oppList.slice(0, 3).filter((o) => o.count > 0);
      
      const neverFaced = oppList.filter((o) => o.count === 0);
      const leastFrequent = oppList.filter((o) => o.count > 0).reverse().slice(0, 3);

      return {
        cid,
        mostFrequent,
        leastFrequent,
        neverFaced,
        totalPicks: nationCounts[cid] || 0
      };
    }).filter(s => s.totalPicks > 0) // Only show stats for nations that were actually played
    .sort((a, b) => b.totalPicks - a.totalPicks);

    return {
      valid2v2Matches,
      mostPopular,
      leastPopular,
      opponentStats,
      popularPlayerInfo: mostPopularPlayerId ? {
        id: mostPopularPlayerId,
        name: mostPopularPlayerName,
        steamUrl: mostPopularPlayerSteamUrl,
        totalMatches: maxPlayerMatches,
        topAllies,
        topEnemies
      } : null
    };
  }, [results]);

  const [isActivePlayerOpen, setIsActivePlayerOpen] = useState(true);
  const [isOpponentsOpen, setIsOpponentsOpen] = useState(false);

  if (!stats) return null;

  const renderNation = (cid: number, count?: number) => {
    const name = nationCodes[cid as keyof typeof nationCodes];
    const flag = getFlagUrl(name);
    return (
      <span className="insight-nation">
        {flag && <img src={flag} alt={name} className="insight-flag" />}
        <span className="insight-nation-name">{name}</span>
        {count !== undefined && <span className="insight-count">({count})</span>}
      </span>
    );
  };

  const renderPlayerNameWithTooltip = (name: string, lanid?: number, steamUrl?: string) => {
    if (lanid === undefined) return <strong>{name}</strong>;
    
    return (
      <span className="steam-link-wrapper">
        <strong style={{ cursor: "help", borderBottom: "1px dotted #888" }}>{name}</strong>
        <div className="steam-tooltip">
          <div className="steam-tooltip-arrow"></div>
          <div className="steam-tooltip-content">
            <div>LAN ID: {lanid}</div>
            {steamUrl && (
              <a 
                href={steamUrl} 
                target="_blank" 
                rel="noreferrer" 
                style={{ color: "#22d3ee", textDecoration: "underline", fontSize: "11px", display: "inline-block", marginTop: "4px" }}
              >
                View Steam Profile
              </a>
            )}
          </div>
        </div>
      </span>
    );
  };

  return (
    <div className="insights-panel card">
      <h3 className="insights-title">📊 2v2 Match Insights (Non-Random)</h3>
      <p className="insights-subtitle">Based on {stats.valid2v2Matches} valid 2v2 matches.</p>

      <div className="insights-grid">
        <div className="insight-box">
          <h4>🏆 Top 5 Most Popular Nations</h4>
          <ol>
            {stats.mostPopular.map((n) => (
              <li key={n.cid}>{renderNation(n.cid, n.count)}</li>
            ))}
          </ol>
        </div>

        <div className="insight-box">
          <h4>📉 Top 5 Least Popular Nations</h4>
          <ol>
            {stats.leastPopular.map((n) => (
              <li key={n.cid}>{renderNation(n.cid, n.count)}</li>
            ))}
          </ol>
        </div>
      </div>

      {stats.popularPlayerInfo && stats.popularPlayerInfo.totalMatches > 0 && (
        <>
          <h4 
            className="insights-subhead collapsible-header"
            onClick={() => setIsActivePlayerOpen(!isActivePlayerOpen)}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              👤 Most Active Player: 
              <span style={{ color: '#22d3ee' }}>
                {renderPlayerNameWithTooltip(stats.popularPlayerInfo.name, Number(stats.popularPlayerInfo.id), stats.popularPlayerInfo.steamUrl)}
              </span> 
              ({stats.popularPlayerInfo.totalMatches} matches)
            </span>
            <span className="collapse-icon">{isActivePlayerOpen ? '−' : '+'}</span>
          </h4>
          {isActivePlayerOpen && (
            <div className="insights-grid">
              <div className="insight-box">
                <h4>🤝 Top 3 Friends (Allies)</h4>
                {stats.popularPlayerInfo.topAllies.length > 0 ? (
                  <ol>
                    {stats.popularPlayerInfo.topAllies.map((ally, idx) => (
                      <li key={idx}>
                        {renderPlayerNameWithTooltip(ally.name, ally.lanid, ally.steamUrl)}{" "}
                        <span className="insight-count">({ally.count} games)</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="text-muted">Not enough data</div>
                )}
              </div>

              <div className="insight-box">
                <h4>😈 Top 3 Nemesis (Opponents)</h4>
                {stats.popularPlayerInfo.topEnemies.length > 0 ? (
                  <ol>
                    {stats.popularPlayerInfo.topEnemies.map((enemy, idx) => (
                      <li key={idx}>
                        {renderPlayerNameWithTooltip(enemy.name, enemy.lanid, enemy.steamUrl)}{" "}
                        <span className="insight-count">({enemy.count} games)</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="text-muted">Not enough data</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <h4 
        className="insights-subhead collapsible-header" 
        onClick={() => setIsOpponentsOpen(!isOpponentsOpen)}
      >
        <span>⚔️ Opponent Frequencies (Per Nation)</span>
        <span className="collapse-icon">{isOpponentsOpen ? '−' : '+'}</span>
      </h4>
      
      {isOpponentsOpen && (
        <div className="insights-opponents-list">
          {stats.opponentStats.map((stat) => (
            <div key={stat.cid} className="insight-opp-row">
              <div className="insight-opp-main">{renderNation(stat.cid)}</div>
              <div className="insight-opp-details">
                <div className="insight-opp-group">
                  <strong>Most Frequent Opponents:</strong>
                  {stat.mostFrequent.length > 0 ? (
                    <span className="insight-opp-items">
                      {stat.mostFrequent.map((o) => (
                        <span key={o.cid}>{renderNation(o.cid, o.count)}</span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted">None</span>
                  )}
                </div>
                
                <div className="insight-opp-group">
                  <strong>Least Frequent Opponents:</strong>
                  {stat.leastFrequent.length > 0 ? (
                    <span className="insight-opp-items">
                      {stat.leastFrequent.map((o) => (
                        <span key={o.cid}>{renderNation(o.cid, o.count)}</span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted">None (or only never faced)</span>
                  )}
                </div>

                {stat.neverFaced.length > 0 && (
                  <div className="insight-opp-group insight-never-faced">
                    <strong>Never Faced:</strong>
                    <span className="insight-opp-items muted">
                      {stat.neverFaced.map((o) => (
                        <span key={o.cid}>{nationCodes[o.cid as keyof typeof nationCodes]}</span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
