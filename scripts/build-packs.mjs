#!/usr/bin/env node
/**
 * 產製地標包：從 OpenStreetMap 抓某個地區的連鎖門市座標，輸出成 App 可下載的 JSON。
 *
 *   npm run packs:list                     # 看有哪些地區包、狀態如何
 *   npm run packs:build -- tw-taipei       # 產製單一地區
 *   npm run packs:build -- tw-taipei jp-tokyo kr-seoul
 *   npm run packs:build -- --region TW     # 產製整個台灣（22 個縣市，會跑很久）
 *   npm run packs:build -- --all           # 全部（很久，而且對 Overpass 不禮貌，別亂用）
 *
 * 資料來源與授權（重要）：
 *   OpenStreetMap 的資料以 ODbL 授權。你可以自由使用、修改、商業使用，
 *   但有兩個義務：
 *     1. 標示來源（App 的地標包畫面已經寫上「© OpenStreetMap 貢獻者」）
 *     2. 如果你公開發布「改作後的資料庫」，那份衍生資料庫也要以 ODbL 授權
 *   把 OSM 資料當成 App 的內容來用、標好來源，這是最常見也最安全的用法。
 *   台灣的門市也可以改用政府資料開放平臺（data.gov.tw）或各通路官方 API，
 *   授權條件不同，通常更寬鬆，但覆蓋率與更新頻率要自己評估。
 *
 * 對 Overpass 要有禮貌：
 *   這是志工營運的免費服務。腳本每個請求之間會等待，也設了超時與重試。
 *   不要把它塞進 CI 每小時跑一次，那會害到所有人（也會被封 IP）。
 *   一個地區的門市資料半年更新一次就夠了。
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = join(ROOT, 'public/data/packs/index.json');
const PACK_DIR = join(ROOT, 'public/data/packs');

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const TIMEOUT_MS = 180_000;
const DELAY_BETWEEN_PACKS_MS = 8000;
const USER_AGENT = 'PayNavTaiwan/1.0 (poi pack builder; contact via repo issues)';

/**
 * 品牌 → 通路代號的對照表。
 * OSM 的品牌標記不統一（brand、brand:en、name 都可能），所以用正規表達式比對。
 * 順序有意義：先命中的先算。
 */
const BRAND_RULES = {
  TW: [
    // 超商
    ['seven_eleven', /7-?eleven|セブン|統一超商|7-11/i],
    ['family_mart', /family\s?mart|全家便利商店|ファミリーマート/i],
    ['hi_life', /hi-?life|萊爾富/i],
    ['ok_mart', /\bok\s?mart\b|ok超商|來來超商/i],
    ['simple_mart', /simple\s?mart|美廉社/i],
    // 超市與量販
    ['carrefour_market', /家樂福便利購|carrefour\s?market/i],
    ['carrefour', /carrefour|家樂福/i],
    ['pxmart', /px\s?mart|全聯/i],
    ['fongkang', /楓康/i],
    ['rtmart', /rt-?mart|大潤發/i],
    ['aimart', /a\.?mart|愛買/i],
    ['costco', /costco|好市多/i],
    // 咖啡與手搖
    ['starbucks', /starbucks|星巴克/i],
    ['louisa', /louisa|路易莎/i],
    ['cama', /cama/i],
    ['cafe85', /85\s?度\s?c|85cafe/i],
    ['mrbrown', /mr\.?\s?brown|伯朗咖啡/i],
    ['wulan50', /50嵐|五十嵐/i],
    ['chingshin', /清心福全|清心/i],
    ['milkshop', /迷客夏|milk\s?shop/i],
    ['kebuke', /可不可/i],
    ['guiji', /龜記/i],
    // 速食與餐廳
    ['mcdonalds', /mcdonald|麥當勞/i],
    ['mos_burger', /mos\s?burger|摩斯漢堡/i],
    ['kfc', /\bkfc\b|肯德基/i],
    ['subway', /subway/i],
    ['burger_king', /burger\s?king|漢堡王/i],
    ['bafang', /八方雲集/i],
    ['tkk', /頂呱呱|tkk/i],
    ['wowprime', /王品|西堤|陶板屋|石二鍋|hot\s?7|聚北海道/i],
    ['sushiro', /sushiro|壽司郎/i],
    ['kura_sushi', /kura|藏壽司/i],
    ['thai_town', /瓦城|thai\s?town/i],
    ['chujian', /築間/i],
    ['haidilao', /海底撈|hai\s?di\s?lao/i],
    ['bakery_chain', /一之軒|聖瑪莉|馬可先生|順成蛋糕/i],
    ['ikari', /亞尼克|伊莎貝爾/i],
    // 藥妝藥局
    ['watsons', /watsons|屈臣氏/i],
    ['cosmed', /cosmed|康是美/i],
    ['poya', /poya|寶雅/i],
    ['tomods', /tomod/i],
    ['dashu', /大樹藥局|大樹連鎖/i],
    ['hsin_yi', /杏一/i],
    // 百貨
    ['shin_kong', /新光三越|shin\s?kong\s?mitsukoshi/i],
    ['sogo', /\bsogo\b|太平洋崇光/i],
    ['far_eastern', /遠東百貨|遠百|far\s?eastern\s?department/i],
    ['breeze', /微風廣場|breeze\s?center/i],
    ['mitsui_outlet', /三井\s?outlet|mitsui\s?outlet/i],
    // 3C 與居家
    ['tkec', /燦坤|tkec/i],
    ['elife', /全國電子/i],
    ['sunfar', /順發/i],
    ['apple_store', /apple\s?store/i],
    ['ikea', /\bikea\b|宜家/i],
    ['test_rite', /特力屋|test\s?rite|\bhola\b/i],
    ['nitori', /nitori|宜得利/i],
    ['xiaobei', /小北百貨/i],
    ['kuangnan', /光南/i],
    ['daiso_tw', /daiso|大創/i],
    // 書店與娛樂
    ['eslite', /eslite|誠品/i],
    ['kingstone', /金石堂|kingstone/i],
    ['vieshow', /vieshow|威秀/i],
    ['showtime', /秀泰/i],
    ['ktv', /錢櫃|好樂迪|partyworld/i],
    // 加油站
    ['cpc', /中油|cpc\s?corporation|台灣中油/i],
    ['fpcc', /台塑石油|formosa\s?petro/i],
    ['nps', /全國加油站/i],
  ],
  JP: [
    // 便利商店拆到品牌層級（原本是合併成 jp_convenience 一條，
    // 現在細到能對應精確的會員點數系統：LAWSON=PONTA、7-ELEVEN=nanaco 等）
    ['jp_seven', /7-?eleven|セブン-?イレブン|セブン/i],
    ['jp_lawson', /\blawson\b|ローソン/i],
    ['jp_familymart', /family\s?mart|ファミリーマート/i],
    ['jp_convenience', /ミニストップ|ministop|デイリーヤマザキ/i], // 抓不到具體品牌的日本便利商店，留在分類層級
    ['jp_donki', /don\s?quijote|ドン・?キホーテ|驚安の殿堂/i],
    ['jp_drugstore', /matsumoto\s?kiyoshi|マツモトキヨシ|サンドラッグ|ココカラ|スギ薬局|ダイコク|コスモス薬品/i],
    ['jp_department', /bic\s?camera|ビックカメラ|ヨドバシ|yodobashi|髙島屋|高島屋|大丸|伊勢丹|三越|パルコ|parco/i],
    ['jp_supermarket', /イオン|aeon|イトーヨーカドー|ライフ|マルエツ|業務スーパー|まいばすけっと/i],
    ['jp_restaurant', /一蘭|ichiran|吉野家|yoshinoya|すき家|松屋|coco壱|ココイチ|マクドナルド|mcdonald|モスバーガー|mos\s?burger|スターバックス|starbucks|サイゼリヤ/i],
  ],
  KR: [
    ['kr_daiso', /daiso|다이소|大創/i],
    // 便利商店拆到品牌層級（CU=CJ ONE、GS25=Happy Point 等各自對應不同點數系統）
    ['kr_cu', /\bcu\b|씨유/i],
    ['kr_gs25', /gs25|지에스25/i],
    ['kr_seven', /7-?eleven|세븐일레븐/i],
    ['kr_emart24', /emart24|이마트24/i],
    ['kr_convenience', /ministop|미니스톱/i], // 抓不到具體品牌的韓國便利商店，留在分類層級
    ['kr_cosmetics', /olive\s?young|올리브영|innisfree|이니스프리|the\s?face\s?shop|missha|nature\s?republic/i],
    ['kr_cafe', /compose|컴포즈|ediya|이디야|twosome|투썸|paris\s?baguette|파리바게뜨|starbucks|스타벅스|mega\s?coffee|메가커피|31|baskin/i],
    ['kr_supermarket', /lotte\s?mart|롯데마트|emart|이마트|homeplus|홈플러스|no\s?brand|노브랜드/i],
    ['kr_department', /lotte\s?department|롯데백화점|hyundai\s?department|현대백화점|shinsegae|신세계|현대아울렛/i],
    ['kr_dutyfree', /duty\s?free|면세점/i],
    ['kr_market', /시장|traditional\s?market/i],
  ],
};

/** 各地區要抓的 OSM 標籤，範圍開大一點，之後靠 BRAND_RULES 過濾 */
const OSM_FILTERS = [
  'shop=convenience',
  'shop=supermarket',
  'shop=chemist',
  'shop=pharmacy',
  'shop=variety_store',
  'shop=department_store',
  'shop=cosmetics',
  'shop=electronics',
  'shop=furniture',
  'shop=books',
  'shop=stationery',
  'shop=bakery',
  'shop=doityourself',
  'shop=mall',
  'amenity=cafe',
  'amenity=fast_food',
  'amenity=restaurant',
  'amenity=fuel',
  'amenity=cinema',
  'amenity=bubble_tea',
];

const args = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readIndex() {
  return JSON.parse(await readFile(INDEX_PATH, 'utf8'));
}

export function buildQuery(bbox, filters = OSM_FILTERS) {
  const [s, w, n, e] = bbox;
  const box = `${s},${w},${n},${e}`;
  const parts = filters.flatMap((filter) => {
    const [key, value] = filter.split('=');
    return [`node["${key}"="${value}"](${box});`, `way["${key}"="${value}"](${box});`];
  });
  return `[out:json][timeout:170];(${parts.join('')});out center tags;`;
}

/**
 * 把 20 個標籤切成幾批小查詢，而不是一次全部塞進同一條查詢。
 *
 * 為什麼要這樣做：像台北市這種高密度地區，單一大查詢要處理的節點數量
 * 非常龐大，即使 Overpass 伺服器本身健康，也容易在 170 秒逾時內算不完，
 * 回傳 504／502。拆成小批之後，每批負擔小很多，個別批次失敗也只影響
 * 那幾個標籤，不會讓整個地區直接失敗——失敗的那幾批之後可以單獨重跑。
 */
const FILTER_BATCH_SIZE = 5;

function batchFilters(filters) {
  const batches = [];
  for (let i = 0; i < filters.length; i += FILTER_BATCH_SIZE) {
    batches.push(filters.slice(i, i + FILTER_BATCH_SIZE));
  }
  return batches;
}

async function runOverpass(query) {
  let lastError;
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
          },
          body: new URLSearchParams({ data: query }).toString(),
        });
        if (res.status === 429 || res.status === 504) {
          throw new Error(`伺服器忙碌（${res.status}）`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.log(`    · ${endpoint.split('/')[2]} 第 ${attempt} 次失敗：${message}`);
        await sleep(5000 * attempt);
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw lastError ?? new Error('所有 Overpass 節點都失敗');
}

export function matchChannel(region, tags) {
  const haystack = [tags.brand, tags['brand:en'], tags['brand:zh'], tags.name, tags['name:en'], tags.operator]
    .filter(Boolean)
    .join(' | ');
  if (!haystack) return null;
  for (const [channel, pattern] of BRAND_RULES[region] ?? []) {
    if (pattern.test(haystack)) return channel;
  }
  return null;
}

const CATEGORY_BY_CHANNEL = {
  convenience: /^(seven_eleven|family_mart|hi_life|ok_mart|simple_mart|jp_convenience|kr_convenience)$/,
  supermarket: /^(pxmart|carrefour_market|fongkang|jp_supermarket|kr_supermarket)$/,
  hypermarket: /^(carrefour|rtmart|aimart|costco)$/,
  coffee: /^(starbucks|louisa|cama|cafe85|mrbrown|kr_cafe)$/,
  beverage: /^(wulan50|chingshin|milkshop|kebuke|guiji)$/,
  fastfood: /^(mcdonalds|mos_burger|kfc|subway|burger_king|bafang|tkk)$/,
  restaurant: /^(wowprime|sushiro|kura_sushi|thai_town|chujian|haidilao|jp_restaurant|kr_restaurant)$/,
  bakery: /^(bakery_chain|ikari)$/,
  drugstore: /^(watsons|cosmed|poya|tomods|dashu|hsin_yi|jp_drugstore|kr_cosmetics)$/,
  department: /^(shin_kong|sogo|far_eastern|breeze|mitsui_outlet|jp_department|kr_department|kr_dutyfree)$/,
  electronics: /^(tkec|elife|sunfar|apple_store)$/,
  homeware: /^(ikea|test_rite|nitori|xiaobei|kuangnan|daiso_tw|jp_donki|kr_daiso)$/,
  bookstore: /^(eslite|kingstone)$/,
  entertainment: /^(vieshow|showtime|ktv)$/,
  fuel: /^(cpc|fpcc|nps)$/,
};

function categoryOf(channel) {
  for (const [category, pattern] of Object.entries(CATEGORY_BY_CHANNEL)) {
    if (pattern.test(channel)) return category;
  }
  return 'general';
}

/**
 * 同一個品牌在約 25 公尺內重複出現視為同一間店（OSM 常有 node + way 重複）。
 *
 * 用網格分桶而不是兩兩比對：東京一個包有近八千筆，
 * 兩兩比對是六千萬次運算，分桶之後只比鄰近的九格。
 */
export function dedupe(stores) {
  const CELL = 0.00025; // 約 25 公尺
  const buckets = new Map();
  const out = [];

  const keyOf = (id, gx, gy) => `${id}@${gx},${gy}`;

  for (const store of stores) {
    const gx = Math.round(store.latitude / CELL);
    const gy = Math.round(store.longitude / CELL);

    let duplicated = false;
    for (let dx = -1; dx <= 1 && !duplicated; dx += 1) {
      for (let dy = -1; dy <= 1 && !duplicated; dy += 1) {
        const neighbours = buckets.get(keyOf(store.id, gx + dx, gy + dy));
        if (!neighbours) continue;
        duplicated = neighbours.some(
          (s) =>
            Math.abs(s.latitude - store.latitude) < CELL &&
            Math.abs(s.longitude - store.longitude) < CELL,
        );
      }
    }
    if (duplicated) continue;

    const key = keyOf(store.id, gx, gy);
    const list = buckets.get(key);
    if (list) list.push(store);
    else buckets.set(key, [store]);
    out.push(store);
  }

  return out;
}

export function toStores(region, elements) {
  const stores = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const channel = matchChannel(region, tags);
    if (!channel) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    const branch =
      tags['branch'] ||
      tags['name:zh'] ||
      tags['name'] ||
      tags['addr:full'] ||
      tags['addr:street'] ||
      '';

    stores.push({
      uid: `osm-${el.type?.[0] ?? 'n'}${el.id}`,
      id: channel,
      name: tags.brand || tags['brand:zh'] || tags.name || channel,
      branch: branch.slice(0, 40),
      category: categoryOf(channel),
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      region,
    });
  }
  return dedupe(stores);
}

async function buildPack(pack, index) {
  console.log(`\n▶ ${pack.label}（${pack.id}）`);
  console.log(`    範圍 ${pack.bbox.join(', ')}`);

  const batches = batchFilters(OSM_FILTERS);
  const allElements = [];
  let failedBatches = 0;

  for (const [i, batch] of batches.entries()) {
    const label = batch.map((f) => f.split('=')[1]).join('、');
    try {
      const raw = await runOverpass(buildQuery(pack.bbox, batch));
      const count = raw.elements?.length ?? 0;
      allElements.push(...(raw.elements ?? []));
      console.log(`    · 第 ${i + 1}/${batches.length} 批（${label}）：${count} 筆`);
    } catch (error) {
      failedBatches += 1;
      console.log(`    · 第 ${i + 1}/${batches.length} 批（${label}）失敗：${error.message}`);
    }
    // 批次之間也要客氣，不要背靠背連續打
    if (i < batches.length - 1) await sleep(3000);
  }

  if (failedBatches > 0) {
    console.log(
      `    ⚠ ${failedBatches}/${batches.length} 批查詢失敗，這個包會用其餘成功的批次資料產出（可能不完整）`,
    );
  }

  const stores = toStores(pack.region, allElements);

  if (stores.length === 0) {
    console.log('    ✗ 沒有比對到任何連鎖門市，這個包不寫入');
    console.log('      可能是所有批次都失敗、bbox 錯了，或 BRAND_RULES 需要補這個地區的品牌');
    return null;
  }

  const version = new Date().toISOString().slice(0, 10);
  const payload = {
    id: pack.id,
    region: pack.region,
    area: pack.area,
    version,
    attribution: '© OpenStreetMap 貢獻者，ODbL 授權',
    stores,
  };
  const json = `${JSON.stringify(payload)}\n`;
  await mkdir(PACK_DIR, { recursive: true });
  await writeFile(join(PACK_DIR, `${pack.id}.json`), json);

  const sizeKb = Math.max(1, Math.round(Buffer.byteLength(json) / 1024));
  const byChannel = stores.reduce((acc, s) => {
    acc[s.id] = (acc[s.id] ?? 0) + 1;
    return acc;
  }, {});

  const entry = index.packs.find((p) => p.id === pack.id);
  entry.status = 'ready';
  entry.version = version;
  entry.storeCount = stores.length;
  entry.sizeKb = sizeKb;
  entry.channels = Object.keys(byChannel).sort();

  console.log(`    ✓ ${stores.length} 間門市、${sizeKb} KB`);
  console.log(
    `      ${Object.entries(byChannel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => `${k} ${v}`)
      .join('、')}`,
  );
  return entry;
}

async function main() {
  const index = await readIndex();

  if (args.includes('--list') || args.length === 0) {
    const grouped = { TW: [], JP: [], KR: [] };
    for (const p of index.packs) grouped[p.region]?.push(p);
    for (const [region, list] of Object.entries(grouped)) {
      if (!list.length) continue;
      console.log(`\n【${region}】`);
      for (const p of list) {
        const mark = p.status === 'ready' ? '✓' : '·';
        const detail =
          p.status === 'ready'
            ? `${p.storeCount} 間 / ${p.sizeKb} KB / ${p.version}`
            : `尚未產製（估 ${p.storeCount} 間 / ${p.sizeKb} KB）`;
        console.log(`  ${mark} ${p.id.padEnd(18)} ${p.area.padEnd(8)} ${detail}`);
      }
    }
    console.log('\n產製指令：npm run packs:build -- <pack id> [更多 id...]');
    console.log('也可以用 --region TW 產製整個國家，或 --all 全部（會跑很久）。\n');
    return;
  }

  let targets;
  if (args.includes('--all')) {
    targets = index.packs;
  } else if (args.includes('--region')) {
    const region = args[args.indexOf('--region') + 1]?.toUpperCase();
    targets = index.packs.filter((p) => p.region === region);
    if (!targets.length) {
      console.error(`✗ 沒有這個地區：${region}（可用 TW / JP / KR）`);
      process.exit(1);
    }
  } else {
    const ids = args.filter((a) => !a.startsWith('--'));
    targets = ids.map((id) => {
      const found = index.packs.find((p) => p.id === id);
      if (!found) {
        console.error(`✗ 找不到地標包：${id}（跑 npm run packs:list 看清單）`);
        process.exit(1);
      }
      return found;
    });
  }

  console.log(`要產製 ${targets.length} 個地標包。`);
  console.log('資料來源 OpenStreetMap（ODbL），每個包之間會等 8 秒，請耐心等。');

  let ok = 0;
  for (const [i, pack] of targets.entries()) {
    try {
      const result = await buildPack(pack, index);
      if (result) ok += 1;
    } catch (error) {
      console.log(`    ✗ ${pack.label} 產製失敗：${error.message}`);
    }
    if (i < targets.length - 1) await sleep(DELAY_BETWEEN_PACKS_MS);
  }

  index.updated_at = new Date().toISOString().slice(0, 10);
  index.version = `2026.08-catalog+${index.packs.filter((p) => p.status === 'ready').length}`;
  await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);

  console.log(`\n完成 ${ok} / ${targets.length} 個包。`);
  console.log('記得 commit public/data/packs/ 才會跟著網站一起部署。');
  if (ok > 0) {
    console.log('包變多之後 repo 會變大，那時候可以考慮改放 Cloudflare R2，見 docs/06。');
  }
}

// 被當成模組 import 時（例如跑測試）不要自動執行
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('build-packs.mjs');
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`✗ 腳本失敗：${error.message}`);
    process.exit(1);
  });
}
