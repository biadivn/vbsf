'use strict';
/* Smoke test: boot Strapi headlessly, create + read records through every
   content-type that carries components/JSON (tournament, member), then exit.
   Run with: node scripts/smoke-test.js */
const { compileStrapi, createStrapi } = require('@strapi/strapi');

(async () => {
  const app = await compileStrapi();
  const instance = await createStrapi(app).load();

  try {
    const member = await instance.documents('api::member.member').create({
      data: {
        code: 'VBSF-2026-SMOKE',
        name: 'Nguyễn Văn Test',
        cccd: '000000000001',
        phone: '0900000001',
        category: 'Pool 9 bi',
        group: 'Nam',
        club: 'CLB Smoke Test',
        province: 'TP.HCM',
        status: 'active',
        disciplines: [
          { category: 'Pool 9 bi', points: 2000, rank: 1, matches: 10, trend: 'up', trendValue: 2 },
          { category: 'Snooker', points: 300, rank: null, matches: 2, trend: 'eq', trendValue: 0 }
        ],
        freeMatches: [
          { category: 'Pool 9 bi', opponent: 'Trần Văn B', score1: 5, score2: 3, points: 8, date: '2026-08-01' }
        ]
      }
    });
    console.log('CREATED member:', member.id, member.name);

    const tournament = await instance.documents('api::tournament.tournament').create({
      data: {
        name: 'Giải Smoke Test 2026',
        category: 'Pool 9 bi',
        format: 'SE',
        status: 'ongoing',
        mode: 'op',
        players: [
          { name: member.name, club: member.club, feeStatus: 'paid', registeredAt: new Date().toISOString(), member: member.id },
          { name: 'Khách mời Test', club: '', feeStatus: 'unpaid' }
        ],
        prizes: [
          { rank: '1', cash: '5.000.000đ', item: 'Cúp' }
        ],
        bracket: {
          type: 'SE', size: 2, k: 1,
          matches: { 0: { id: 0, br: 'W', round: 0, p1: 'seed-a', p2: 'seed-b', win: null, status: 'ready' } },
          rounds: [[0]]
        }
      }
    });
    console.log('CREATED tournament:', tournament.id, tournament.name);

    const fetchedMember = await instance.documents('api::member.member').findOne({
      documentId: member.documentId,
      populate: ['disciplines', 'freeMatches']
    });
    console.log('READ BACK member disciplines:', JSON.stringify(fetchedMember.disciplines));
    console.log('READ BACK member freeMatches:', JSON.stringify(fetchedMember.freeMatches));

    const fetchedTournament = await instance.documents('api::tournament.tournament').findOne({
      documentId: tournament.documentId,
      populate: ['players', 'prizes']
    });
    console.log('READ BACK tournament players:', JSON.stringify(fetchedTournament.players));
    console.log('READ BACK tournament bracket:', JSON.stringify(fetchedTournament.bracket));

    await instance.documents('api::member.member').delete({ documentId: member.documentId });
    await instance.documents('api::tournament.tournament').delete({ documentId: tournament.documentId });
    console.log('\nCleaned up test records.');
    console.log('SMOKE TEST PASSED');
  } catch (err) {
    console.error('SMOKE TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await instance.destroy();
  }
})();
