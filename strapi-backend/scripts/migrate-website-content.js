'use strict';
/* =========================================================
   MIGRATION — nạp toàn bộ nội dung của website prototype tĩnh
   (`VBSF Web.html`) vào Strapi.

   Khác với scripts/seed.js (lấy dữ liệu demo của CMS và bỏ qua nguyên
   collection nếu đã có bản ghi), script này lấy nguồn từ prototype
   website và upsert theo *khoá tự nhiên* của từng bản ghi, nên chạy lại
   nhiều lần không tạo bản trùng và vẫn bổ sung được bản ghi còn thiếu.

   Run:
     node scripts/migrate-website-content.js              # tạo bản ghi còn thiếu
     node scripts/migrate-website-content.js --update     # ghi đè cả bản ghi đã có
     node scripts/migrate-website-content.js --dry-run    # chỉ in kế hoạch, không ghi
     node scripts/migrate-website-content.js --only=news,tournaments

   Nhóm dùng cho --only: settings, contact, news, library-docs,
   media-items, partners, member-orgs, members, tournaments
   ========================================================= */
const { compileStrapi, createStrapi } = require('@strapi/strapi');
const content = require('./website-content');

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const UPDATE = argv.includes('--update');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;

const GROUPS = [
  'settings', 'contact', 'news', 'library-docs',
  'media-items', 'partners', 'member-orgs', 'members', 'tournaments',
];

const stats = [];

function enabled(group) {
  return !ONLY || ONLY.includes(group);
}

/** Upsert collection theo khoá tự nhiên (vd. code / title / name). */
async function upsertCollection(strapi, { group, uid, label, key, items, published }) {
  if (!enabled(group)) return;
  let created = 0, updated = 0, skipped = 0;

  for (const item of items) {
    const keyValue = item[key];
    const existing = await strapi.documents(uid).findFirst({ filters: { [key]: { $eq: keyValue } } });

    if (!existing) {
      if (!DRY_RUN) {
        await strapi.documents(uid).create({ data: item, ...(published ? { status: 'published' } : {}) });
      }
      created++;
    } else if (UPDATE) {
      if (!DRY_RUN) {
        await strapi.documents(uid).update({
          documentId: existing.documentId,
          data: item,
          ...(published ? { status: 'published' } : {}),
        });
      }
      updated++;
    } else {
      skipped++;
    }
  }

  stats.push({ label, created, updated, skipped });
}

/** Single type: tạo nếu chưa có, ghi đè khi --update. */
async function upsertSingleType(strapi, { group, uid, label, data }) {
  if (!enabled(group)) return;
  const existing = await strapi.documents(uid).findFirst();

  if (!existing) {
    if (!DRY_RUN) await strapi.documents(uid).create({ data });
    stats.push({ label, created: 1, updated: 0, skipped: 0 });
  } else if (UPDATE) {
    if (!DRY_RUN) await strapi.documents(uid).update({ documentId: existing.documentId, data });
    stats.push({ label, created: 0, updated: 1, skipped: 0 });
  } else {
    stats.push({ label, created: 0, updated: 0, skipped: 1 });
  }
}

/* Gắn memberId (documentId của hội viên) cho player trong giải đấu — CMS
   dùng field này để nối cơ thủ trong bracket về hồ sơ hội viên. Cơ thủ nào
   chưa có hồ sơ (chỉ xuất hiện trong bảng tỷ số của prototype) thì để null. */
async function linkPlayersToMembers(strapi, tournaments) {
  const memberIdByName = new Map();
  const allMembers = await strapi.documents('api::member.member').findMany({ fields: ['name'], limit: -1 });
  for (const m of allMembers) memberIdByName.set(m.name, m.documentId);

  return tournaments.map((t) => {
    if (!t.players) return t;
    return {
      ...t,
      players: t.players.map((p) => ({ ...p, memberId: memberIdByName.get(p.name) || null })),
    };
  });
}

(async () => {
  if (ONLY) {
    const unknown = ONLY.filter((g) => !GROUPS.includes(g));
    if (unknown.length) {
      console.error(`Nhóm không hợp lệ trong --only: ${unknown.join(', ')}`);
      console.error(`Nhóm hợp lệ: ${GROUPS.join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`MIGRATION nội dung website (nguồn: VBSF Web.html)`);
  console.log(`  chế độ: ${DRY_RUN ? 'DRY RUN — không ghi dữ liệu' : UPDATE ? 'CREATE + UPDATE' : 'CREATE (bỏ qua bản ghi đã có)'}`);
  if (ONLY) console.log(`  chỉ chạy: ${ONLY.join(', ')}`);
  console.log('');

  const app = await compileStrapi();
  const strapi = await createStrapi(app).load();

  try {
    await upsertSingleType(strapi, {
      group: 'settings', uid: 'api::setting.setting',
      label: 'Thông tin tổ chức', data: content.settings,
    });
    await upsertSingleType(strapi, {
      group: 'contact', uid: 'api::contact-info.contact-info',
      label: 'Liên hệ', data: content.contact,
    });

    await upsertCollection(strapi, {
      group: 'news', uid: 'api::news-article.news-article',
      label: 'Tin tức', key: 'title', items: content.news, published: true,
    });
    await upsertCollection(strapi, {
      group: 'library-docs', uid: 'api::library-doc.library-doc',
      label: 'Văn bản & Luật', key: 'title', items: content.libraryDocs,
    });
    await upsertCollection(strapi, {
      group: 'media-items', uid: 'api::media-item.media-item',
      label: 'Thư viện Media', key: 'title', items: content.mediaItems,
    });
    await upsertCollection(strapi, {
      group: 'partners', uid: 'api::partner.partner',
      label: 'Đối tác & Tài trợ', key: 'name', items: content.partners,
    });
    await upsertCollection(strapi, {
      group: 'member-orgs', uid: 'api::member-org.member-org',
      label: 'Hội viên tổ chức', key: 'code', items: content.memberOrgs,
    });
    await upsertCollection(strapi, {
      group: 'members', uid: 'api::member.member',
      label: 'Hội viên & Xếp hạng', key: 'code', items: content.members,
    });

    // Chạy sau members để player trong bracket nối được về hồ sơ hội viên.
    const tournaments = DRY_RUN
      ? content.tournaments
      : await linkPlayersToMembers(strapi, content.tournaments);
    await upsertCollection(strapi, {
      group: 'tournaments', uid: 'api::tournament.tournament',
      label: 'Giải đấu', key: 'name', items: tournaments,
    });

    console.log('');
    for (const s of stats) {
      console.log(`  ${s.label.padEnd(22)} tạo mới ${String(s.created).padStart(3)} · cập nhật ${String(s.updated).padStart(3)} · bỏ qua ${String(s.skipped).padStart(3)}`);
    }
    const total = stats.reduce((acc, s) => acc + s.created + s.updated, 0);
    console.log('');
    console.log(DRY_RUN ? `DRY RUN XONG — sẽ ghi ${total} bản ghi.` : `MIGRATION XONG — đã ghi ${total} bản ghi.`);
    if (!UPDATE && !DRY_RUN && stats.some((s) => s.skipped > 0)) {
      console.log('Bản ghi đã tồn tại được giữ nguyên. Dùng --update nếu muốn ghi đè theo prototype.');
    }
  } catch (err) {
    console.error('MIGRATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
  }
})();
