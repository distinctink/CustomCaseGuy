/** Domain types after Yahoo's JSON has been normalised. */

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | string;

/** Yahoo status codes seen on players. Empty string means healthy. */
export type InjuryStatus =
  | '' | 'Q' | 'D' | 'O' | 'IR' | 'IR-R' | 'PUP' | 'NA' | 'SUSP' | 'COVID-19' | string;

export interface League {
  leagueKey: string;
  leagueId: string;
  name: string;
  numTeams: number;
  currentWeek: number;
  startWeek: number;
  endWeek: number;
  season: string;
  /** Yahoo waiver_type: "R" = rolling priority (reset), "C" = continual. */
  waiverType: string;
  /** Yahoo waiver_rule: "gametime", "all", "none". */
  waiverRule: string;
  usesFaab: boolean;
  scoringType: string;
  isFinished: boolean;
  url?: string;
}

export interface RosterSlot {
  position: string;
  /** Yahoo position_type: "O" offence, "DT" defence/special teams. */
  positionType?: string;
  count: number;
}

export interface StatCategory {
  statId: number;
  name: string;
  displayName: string;
  positionTypes: string[];
  enabled: boolean;
}

export interface LeagueSettings {
  league: League;
  rosterSlots: RosterSlot[];
  statCategories: StatCategory[];
  /** stat_id -> points per unit. */
  statModifiers: Map<number, number>;
  /** Slots that count as starters (everything except BN/IR). */
  startingSlots: RosterSlot[];
  benchCount: number;
  irCount: number;
}

export interface Team {
  teamKey: string;
  teamId: string;
  name: string;
  isOwnedByCurrentLogin: boolean;
  waiverPriority?: number;
  faabBalance?: number;
  numberOfMoves: number;
  numberOfTrades: number;
  managerNicknames: string[];
  url?: string;
}

export interface PlayerRank {
  rankType: string;
  rankValue: number;
  rankSeason?: string;
}

export interface Player {
  playerKey: string;
  playerId: string;
  name: string;
  firstName: string;
  lastName: string;
  team: string;
  teamFullName?: string;
  displayPosition: string;
  primaryPosition: string;
  positionType: string;
  eligiblePositions: string[];
  byeWeek?: number;
  status: InjuryStatus;
  statusFull?: string;
  injuryNote?: string;
  onDisabledList: boolean;
  isUndroppable: boolean;
  uniformNumber?: string;
  /** Present when the player came from a roster query. */
  selectedPosition?: string;
  /** Present when requested via the percent_owned sub-resource. */
  percentOwned?: number;
  percentOwnedDelta?: number;
  ranks: PlayerRank[];
  /** Fantasy points as scored by this league, when stats were requested. */
  points?: number;
  /** Raw stat_id -> value, when stats were requested. */
  stats?: Map<number, number>;
  /** Ownership: "freeagents" | "waivers" | "team". */
  ownership?: string;
  /** When on waivers, the date the claim window closes (ISO). */
  waiverDate?: string;
}

export interface Roster {
  teamKey: string;
  week: number;
  isEditable: boolean;
  players: Player[];
}

export interface TransactionPlayer {
  playerKey: string;
  name: string;
  position: string;
  /** "add" | "drop". */
  type: string;
  sourceType?: string;
  destinationType?: string;
  destinationTeamKey?: string;
  sourceTeamKey?: string;
}

export interface Transaction {
  transactionKey: string;
  transactionId: string;
  /** "add", "drop", "add/drop", "trade", "commish". */
  type: string;
  status: string;
  timestamp: number;
  players: TransactionPlayer[];
  /** Trades only. */
  traderTeamKey?: string;
  tradeeTeamKey?: string;
  tradeNote?: string;
}

export interface MatchupTeam {
  teamKey: string;
  name: string;
  points: number;
  projectedPoints: number;
}

export interface Matchup {
  week: number;
  status: string;
  teams: MatchupTeam[];
}

export interface Standing {
  teamKey: string;
  name: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}
