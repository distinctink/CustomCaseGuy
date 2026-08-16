/**
 * Fixtures mirroring Yahoo's actual `format=json` output shapes — the
 * numeric-keyed collections and array-of-fragments entities described in
 * src/yahoo/parse.ts. Trimmed to the fields we read.
 */

export const rosterResponse = {
  fantasy_content: {
    team: [
      [
        { team_key: '461.l.123456.t.4' },
        { team_id: '4' },
        { name: 'Gridiron Gophers' },
        { is_owned_by_current_login: 1 },
        { waiver_priority: 3 },
        { number_of_moves: '7' },
        { number_of_trades: 0 },
        { managers: [{ manager: { manager_id: '4', nickname: 'Daren' } }] },
      ],
      {
        roster: {
          '0': {
            players: {
              '0': {
                player: [
                  [
                    { player_key: '461.p.30977' },
                    { player_id: '30977' },
                    { name: { full: 'Patrick Mahomes', first: 'Patrick', last: 'Mahomes' } },
                    { editorial_team_abbr: 'KC' },
                    { bye_weeks: { week: '10' } },
                    { display_position: 'QB' },
                    { primary_position: 'QB' },
                    { position_type: 'O' },
                    { eligible_positions: [{ position: 'QB' }] },
                    { status: '' },
                    { is_undroppable: '0' },
                  ],
                  { selected_position: [{ coverage_type: 'week' }, { week: '5' }, { position: 'QB' }] },
                ],
              },
              '1': {
                player: [
                  [
                    { player_key: '461.p.100001' },
                    { player_id: '100001' },
                    { name: { full: 'Bench Guy', first: 'Bench', last: 'Guy' } },
                    { editorial_team_abbr: 'NYJ' },
                    { display_position: 'RB' },
                    { primary_position: 'RB' },
                    { position_type: 'O' },
                    { eligible_positions: [{ position: 'RB' }, { position: 'W/R/T' }] },
                    { status: 'Q' },
                    { status_full: 'Questionable' },
                    { is_undroppable: '0' },
                  ],
                  { selected_position: [{ coverage_type: 'week' }, { week: '5' }, { position: 'BN' }] },
                ],
              },
              count: 2,
            },
          },
          coverage_type: 'week',
          week: '5',
          is_editable: 1,
        },
      },
    ],
  },
};

export const settingsResponse = {
  fantasy_content: {
    league: [
      {
        league_key: '461.l.123456',
        league_id: '123456',
        name: 'Sunday Scaries',
        num_teams: 12,
        current_week: '5',
        start_week: '1',
        end_week: '17',
        season: '2025',
        waiver_type: 'R',
        waiver_rule: 'gametime',
        uses_faab: '0',
        scoring_type: 'head',
        is_finished: 0,
      },
      {
        settings: [
          {
            roster_positions: [
              { roster_position: { position: 'QB', position_type: 'O', count: 1 } },
              { roster_position: { position: 'RB', position_type: 'O', count: 2 } },
              { roster_position: { position: 'WR', position_type: 'O', count: 2 } },
              { roster_position: { position: 'TE', position_type: 'O', count: 1 } },
              { roster_position: { position: 'W/R/T', position_type: 'O', count: 1 } },
              { roster_position: { position: 'K', position_type: 'K', count: 1 } },
              { roster_position: { position: 'DEF', position_type: 'DT', count: 1 } },
              { roster_position: { position: 'BN', count: 6 } },
              { roster_position: { position: 'IR', count: 1 } },
            ],
            stat_categories: {
              stats: [
                { stat: { stat_id: 4, enabled: '1', name: 'Passing Yards', display_name: 'Pass Yds' } },
                { stat: { stat_id: 5, enabled: '1', name: 'Passing Touchdowns', display_name: 'Pass TD' } },
                { stat: { stat_id: 11, enabled: '1', name: 'Receptions', display_name: 'Rec' } },
                { stat: { stat_id: 12, enabled: '1', name: 'Reception Yards', display_name: 'Rec Yds' } },
                { stat: { stat_id: 13, enabled: '1', name: 'Reception Touchdowns', display_name: 'Rec TD' } },
              ],
            },
            stat_modifiers: {
              stats: [
                { stat: { stat_id: 4, value: '0.04' } },
                { stat: { stat_id: 5, value: '4' } },
                { stat: { stat_id: 11, value: '1' } },
                { stat: { stat_id: 12, value: '0.1' } },
                { stat: { stat_id: 13, value: '6' } },
              ],
            },
          },
        ],
      },
    ],
  },
};

export const freeAgentsResponse = {
  fantasy_content: {
    league: [
      { league_key: '461.l.123456', name: 'Sunday Scaries' },
      {
        players: {
          '0': {
            player: [
              [
                { player_key: '461.p.200001' },
                { player_id: '200001' },
                { name: { full: "Ja'Marr Waiver", first: "Ja'Marr", last: 'Waiver' } },
                { editorial_team_abbr: 'cin' },
                { display_position: 'WR' },
                { primary_position: 'WR' },
                { position_type: 'O' },
                { eligible_positions: [{ position: 'WR' }, { position: 'W/R/T' }] },
                { status: '' },
                { is_undroppable: '0' },
                {
                  player_ranks: [
                    { player_rank: { rank_type: 'PR', rank_value: '42', rank_season: '2025' } },
                    { player_rank: { rank_type: 'AR', rank_value: '31', rank_season: '2025' } },
                  ],
                },
              ],
              { percent_owned: [{ coverage_type: 'week' }, { value: 34 }, { delta: 12 }] },
              { ownership: { ownership_type: 'waivers', waiver_date: '2025-10-08' } },
            ],
          },
          count: 1,
        },
      },
    ],
  },
};

export const transactionsResponse = {
  fantasy_content: {
    league: [
      { league_key: '461.l.123456' },
      {
        transactions: {
          '0': {
            transaction: [
              {
                transaction_key: '461.l.123456.tr.55',
                transaction_id: '55',
                type: 'add/drop',
                status: 'successful',
                timestamp: '1728400000',
              },
              {
                players: {
                  '0': {
                    player: [
                      [
                        { player_key: '461.p.300001' },
                        { name: { full: 'Added Player' } },
                        { display_position: 'RB' },
                      ],
                      {
                        transaction_data: [
                          {
                            type: 'add',
                            source_type: 'freeagents',
                            destination_type: 'team',
                            destination_team_key: '461.l.123456.t.7',
                          },
                        ],
                      },
                    ],
                  },
                  '1': {
                    player: [
                      [
                        { player_key: '461.p.300002' },
                        { name: { full: 'Dropped Player' } },
                        { display_position: 'WR' },
                      ],
                      {
                        // Yahoo sometimes sends this as a bare object rather
                        // than a one-element array.
                        transaction_data: {
                          type: 'drop',
                          source_type: 'team',
                          source_team_key: '461.l.123456.t.7',
                          destination_type: 'waivers',
                        },
                      },
                    ],
                  },
                  count: 2,
                },
              },
            ],
          },
          count: 1,
        },
      },
    ],
  },
};

/** ESPN /injuries shape. */
export const espnInjuries = {
  injuries: [
    {
      id: '12',
      displayName: 'Cincinnati Bengals',
      abbreviation: 'CIN',
      injuries: [
        {
          id: 'inj-1',
          status: 'Out',
          date: '2025-10-07T12:00:00Z',
          longComment: 'Sprained ankle, expected to miss multiple weeks.',
          athlete: {
            id: '4362628',
            displayName: 'Starter Back',
            position: { abbreviation: 'RB' },
            team: { abbreviation: 'CIN' },
          },
          type: { name: 'Ankle' },
        },
      ],
    },
  ],
};

/** ESPN /news shape. */
export const espnNews = {
  articles: [
    {
      id: 99001,
      headline: 'Starter Back ruled out for Sunday with ankle injury',
      description: 'The Bengals will be without their lead back.',
      published: new Date().toISOString(),
      type: 'Story',
      links: { web: { href: 'https://espn.com/story/99001' } },
      categories: [
        {
          type: 'athlete',
          athlete: {
            id: 4362628,
            description: 'Starter Back',
            position: { abbreviation: 'RB' },
            team: { abbreviation: 'CIN' },
          },
        },
        { type: 'team', team: { abbreviation: 'CIN' } },
      ],
    },
    {
      id: 99002,
      headline: 'Five fantasy sleepers for week 6',
      description: 'Waiver wire targets.',
      published: new Date().toISOString(),
      type: 'Story',
      categories: [],
    },
  ],
};
