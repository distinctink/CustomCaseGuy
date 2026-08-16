/** Normalised shapes from ESPN's public (undocumented) endpoints. */

export interface EspnAthleteRef {
  id: string;
  name: string;
  position?: string;
  team?: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  description: string;
  /** ISO timestamp from ESPN. */
  published: string;
  publishedMs: number;
  type: string;
  link?: string;
  /** Players ESPN tagged on the story. */
  athletes: EspnAthleteRef[];
  teams: string[];
}

export interface InjuryRecord {
  /** ESPN's id for this injury row; changes when the designation changes. */
  id: string;
  athleteId: string;
  name: string;
  position: string;
  team: string;
  /** "Out", "Questionable", "Doubtful", "Injured Reserve", "Active"… */
  status: string;
  /** Short normalised code: O, Q, D, IR, PUP, SUSP, or '' when active. */
  code: string;
  detail: string;
  date?: string;
  dateMs?: number;
  type?: string;
}

export interface DepthChartEntry {
  athleteId: string;
  name: string;
  rank: number;
  team: string;
  position: string;
}

export interface GameInfo {
  id: string;
  name: string;
  shortName: string;
  date: string;
  dateMs: number;
  /** "pre", "in", "post". */
  state: string;
  statusDetail: string;
  week?: number;
  competitors: { team: string; homeAway: string; score: number }[];
}

export interface TeamInfo {
  id: string;
  abbreviation: string;
  displayName: string;
  byeWeek?: number;
}
