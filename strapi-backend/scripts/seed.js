'use strict';
/* Nạp dữ liệu demo hiện có của CMS (cms-js/seed-data.js + database-queries.js)
   vào Strapi để có dữ liệu thật ngay khi mở Admin / gọi API cục bộ.
   Idempotent: bỏ qua nếu collection đã có dữ liệu.
   Run: node scripts/seed.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { compileStrapi, createStrapi } = require('@strapi/strapi');

function loadCmsSeedData() {
  // Bản sao vendored của cms-js/seed-data.js + database-queries.js (xem
  // scripts/sync-cms-seed-source.js) — để image Docker tự chứa, không phụ
  // thuộc thư mục cms-js nằm ngoài build context.
  const cmsJsDir = path.join(__dirname, 'cms-seed-source');
  const sandbox = {
    console,
    uid: (() => {
      let n = 0;
      return () => 'seed_' + (++n);
    })(),
  };
  vm.createContext(sandbox);
  const seedDataSrc = fs.readFileSync(path.join(cmsJsDir, 'seed-data.js'), 'utf8');
  const dbQueriesSrc = fs.readFileSync(path.join(cmsJsDir, 'database-queries.js'), 'utf8');
  vm.runInContext(seedDataSrc, sandbox, { filename: 'seed-data.js' });
  vm.runInContext(dbQueriesSrc, sandbox, { filename: 'database-queries.js' });
  // `const`/`let` top-level bindings don't attach to the sandbox object itself —
  // bridge them explicitly so they're reachable from the host.
  vm.runInContext('this.__DB_TABLES = DB_TABLES;', sandbox);
  return { seed: sandbox.seedData(), tables: sandbox.__DB_TABLES };
}

async function seedIfEmpty(instance, uid, label, items, mapFn) {
  const count = await instance.documents(uid).count();
  if (count > 0) {
    console.log(`SKIP ${label}: đã có ${count} bản ghi`);
    return;
  }
  for (const raw of items) {
    await instance.documents(uid).create({ data: mapFn(raw), status: 'published' });
  }
  console.log(`SEEDED ${label}: ${items.length} bản ghi`);
}

async function seedSingleTypeIfEmpty(instance, uid, label, data) {
  const existing = await instance.documents(uid).findFirst();
  if (existing) {
    console.log(`SKIP ${label}: đã có dữ liệu`);
    return;
  }
  await instance.documents(uid).create({ data });
  console.log(`SEEDED ${label}`);
}

(async () => {
  const { seed, tables } = loadCmsSeedData();
  const app = await compileStrapi();
  const instance = await createStrapi(app).load();

  try {
    await seedSingleTypeIfEmpty(instance, 'api::setting.setting', 'Thông tin tổ chức', seed.settings);
    await seedSingleTypeIfEmpty(instance, 'api::contact-info.contact-info', 'Liên hệ', seed.contact);

    await seedIfEmpty(instance, 'api::news-article.news-article', 'Tin tức', seed.news, (n) => ({
      title: n.title,
      category: n.category,
      date: n.date,
      author: n.author,
      featured: !!n.featured,
      excerpt: n.excerpt,
      content: n.content,
    }));

    await seedIfEmpty(instance, 'api::library-doc.library-doc', 'Văn bản & Luật', seed.library_docs, (d) => ({
      title: d.title,
      fileType: d.fileType,
      tag: d.tag,
      size: d.size,
      date: d.date,
    }));

    await seedIfEmpty(instance, 'api::media-item.media-item', 'Thư viện Media', seed.library_media, (m) => ({
      title: m.title,
      mediaType: m.mediaType,
      count: m.count,
      date: m.date,
    }));

    await seedIfEmpty(instance, 'api::member-org.member-org', 'Hội viên tổ chức', seed.members_org, (o) => ({
      code: o.code,
      name: o.name,
      orgType: o.orgType,
      taxCode: o.taxCode,
      province: o.province,
      address: o.address,
      repName: o.repName,
      repTitle: o.repTitle,
      repPhone: o.repPhone,
      repEmail: o.repEmail || undefined,
      phone: o.phone,
      password: o.password,
      package: o.package,
      joinDate: o.joinDate,
      expiry: o.expiry || null,
      status: o.status,
    }));

    await seedIfEmpty(instance, 'api::partner.partner', 'Đối tác & Tài trợ', seed.partners, (p) => ({
      name: p.name,
      tier: p.tier,
      description: p.description,
    }));

    await seedIfEmpty(instance, 'api::member.member', 'Hội viên & Xếp hạng', tables.members, (m) => ({
      code: m.code,
      name: m.name,
      cccd: m.cccd,
      phone: m.phone,
      password: m.password,
      category: m.category,
      group: m.group,
      club: m.club || undefined,
      province: m.province,
      status: m.status,
      expiry: m.expiry || null,
      disciplines: (m.disciplines || []).map((d) => ({
        category: d.category,
        points: d.points,
        rank: d.rank,
        matches: d.matches,
        trend: d.trend,
        trendValue: d.trendValue,
      })),
      freeMatches: (m.freeMatches || []).map((fm) => ({
        category: fm.category,
        opponent: fm.opponent,
        score1: fm.score1,
        score2: fm.score2,
        points: fm.points,
        date: fm.date || null,
      })),
    }));

    await seedIfEmpty(instance, 'api::tournament.tournament', 'Giải đấu', tables.tournaments, (t) => ({
      name: t.name,
      category: t.category,
      status: t.status,
      date: t.date,
      participants: typeof t.participants === 'number' ? t.participants : undefined,
      location: t.location || undefined,
      note: t.note || undefined,
      champion: t.champion || undefined,
    }));

    console.log('\nSEED COMPLETE');
  } catch (err) {
    console.error('SEED FAILED:', err);
    process.exitCode = 1;
  } finally {
    await instance.destroy();
  }
})();
