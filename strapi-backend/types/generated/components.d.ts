import type { Schema, Struct } from '@strapi/strapi';

export interface MemberDiscipline extends Struct.ComponentSchema {
  collectionName: 'components_member_disciplines';
  info: {
    description: 'H\u1ED3 s\u01A1 x\u1EBFp h\u1EA1ng c\u1EE7a h\u1ED9i vi\u00EAn theo m\u1ED9t b\u1ED9 m\u00F4n \u2014 m\u1ED7i b\u1ED9 m\u00F4n c\u00F3 \u0111i\u1EC3m/h\u1EA1ng/s\u1ED1 tr\u1EADn ri\u00EAng';
    displayName: 'Discipline Ranking';
  };
  attributes: {
    category: Schema.Attribute.Enumeration<
      [
        'Pool 8 bi',
        'Pool 9 bi',
        'Pool 10 bi',
        'Carom 1 b\u0103ng',
        'Carom 3 b\u0103ng',
        'Snooker',
        'English Billiards',
      ]
    > &
      Schema.Attribute.Required;
    matches: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    points: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    rank: Schema.Attribute.Integer;
    trend: Schema.Attribute.Enumeration<['up', 'down', 'eq']> &
      Schema.Attribute.DefaultTo<'eq'>;
    trendValue: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface MemberFreeMatch extends Struct.ComponentSchema {
  collectionName: 'components_member_free_matches';
  info: {
    description: 'Tr\u1EADn \u0111\u1EA5u t\u1EF1 do (kh\u00F4ng thu\u1ED9c gi\u1EA3i \u0111\u1EA5u) \u2014 c\u1ED9ng/tr\u1EEB \u0111i\u1EC3m x\u1EBFp h\u1EA1ng tr\u1EF1c ti\u1EBFp';
    displayName: 'Free Match';
  };
  attributes: {
    category: Schema.Attribute.Enumeration<
      [
        'Pool 8 bi',
        'Pool 9 bi',
        'Pool 10 bi',
        'Carom 1 b\u0103ng',
        'Carom 3 b\u0103ng',
        'Snooker',
        'English Billiards',
      ]
    > &
      Schema.Attribute.Required;
    date: Schema.Attribute.Date;
    opponent: Schema.Attribute.String & Schema.Attribute.Required;
    points: Schema.Attribute.Integer & Schema.Attribute.Required;
    score1: Schema.Attribute.Integer & Schema.Attribute.Required;
    score2: Schema.Attribute.Integer & Schema.Attribute.Required;
  };
}

export interface SharedPrize extends Struct.ComponentSchema {
  collectionName: 'components_shared_prizes';
  info: {
    description: 'M\u1ED9t h\u1EA1ng gi\u1EA3i th\u01B0\u1EDFng trong gi\u1EA3i \u0111\u1EA5u';
    displayName: 'Prize';
  };
  attributes: {
    cash: Schema.Attribute.String;
    item: Schema.Attribute.String;
    rank: Schema.Attribute.String;
  };
}

export interface TournamentPlayer extends Struct.ComponentSchema {
  collectionName: 'components_tournament_players';
  info: {
    description: 'Ng\u01B0\u1EDDi ch\u01A1i \u0111\u0103ng k\u00FD tham gia m\u1ED9t gi\u1EA3i \u0111\u1EA5u';
    displayName: 'Player';
  };
  attributes: {
    club: Schema.Attribute.String;
    feeStatus: Schema.Attribute.Enumeration<['unpaid', 'paid']> &
      Schema.Attribute.DefaultTo<'unpaid'>;
    localId: Schema.Attribute.String & Schema.Attribute.Required;
    memberId: Schema.Attribute.String;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    rating: Schema.Attribute.Integer;
    registeredAt: Schema.Attribute.DateTime;
    seed: Schema.Attribute.Integer;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'member.discipline': MemberDiscipline;
      'member.free-match': MemberFreeMatch;
      'shared.prize': SharedPrize;
      'tournament.player': TournamentPlayer;
    }
  }
}
