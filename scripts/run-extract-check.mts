/**
 * Node 侧黄金样例检查（不经过 courierIcons / SVG）。
 * 用法: npx tsx scripts/run-extract-check.mts
 */
import { matchTemplates } from '../services/templateEngine.ts';
import {
  isLikelyPickupMessage,
  extractPickupCode,
  extractLocationFromText,
} from '../services/pickupTextRules.ts';

// 临时 monkey：若 pickupTextRules 间接拉入 courierIcons 会炸；当前仅用纯函数路径。

const t1 =
  '【驿小哥】您好，您的顺丰快递0366已到大连理工大学(开发区校区)，可凭1-5-0366到店SF自营大连理工大学开发区店提取。';
const t2 =
  '【驿小哥】您好，您的极兔快递6154已到大连理工大学(开发区校区)，可凭5-1-1-6154到店SF自营大连理工大学开发区店提取。';
const neg = '【顺丰】您的快递单号 SF1234567890123 即将送达，快到了，请保持电话畅通。';

function detectCourierFromText(text: string): string {
  if (/极兔/i.test(text)) return '极兔';
  if (/顺丰/i.test(text)) return '顺丰';
  return '未知';
}

const m1 = matchTemplates(t1);
const m2 = matchTemplates(t2);
const code1 = m1.pickupCode || extractPickupCode(t1);
const code2 = m2.pickupCode || extractPickupCode(t2);
const loc1 = m1.location || extractLocationFromText(t1) || '未知';
const loc2 = m2.location || extractLocationFromText(t2) || '未知';
const c1 = detectCourierFromText(t1);
const c2 = detectCourierFromText(t2);

console.log('T1', { code1, loc1, c1, matched: m1.matched });
console.log('T2', { code2, loc2, c2, matched: m2.matched });
console.log('NEG likely?', isLikelyPickupMessage(neg));

const t1Ok = code1 === '1-5-0366' && c1 === '顺丰' && loc1 !== '未知';
const t2Ok = code2 === '5-1-1-6154' && c2 === '极兔' && loc2 !== '未知';
const negOk = !isLikelyPickupMessage(neg);

if (!t1Ok || !t2Ok || !negOk) {
  console.error('FAILED', { t1Ok, t2Ok, negOk });
  process.exit(1);
}
console.log('All golden samples passed');
