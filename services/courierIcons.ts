import shunfengIcon from '../assets/icons/shunfeng.svg';
import zhongtongIcon from '../assets/icons/zhongtong.svg';
import yuantongIcon from '../assets/icons/yuantong.svg';
import yundaIcon from '../assets/icons/yunda.svg';
import shentongIcon from '../assets/icons/shentong.svg';
import jituIcon from '../assets/icons/jitu.svg';
import jingdongIcon from '../assets/icons/jingdong.svg';
import youzhengIcon from '../assets/icons/youzheng.svg';
import cainiaoIcon from '../assets/icons/cainiao.svg';
import fengchaoIcon from '../assets/icons/fengchao.svg';
import debangIcon from '../assets/icons/debang.svg';

export interface CourierIconDefinition {
  id: string;
  label: string;
  icon: string;
  matchers: RegExp[];
}

export const COURIER_ICON_DEFINITIONS: CourierIconDefinition[] = [
  {
    id: 'shunfeng',
    label: '顺丰',
    icon: shunfengIcon,
    matchers: [/顺丰/i, /sf[-_\s]?express/i],
  },
  {
    id: 'zhongtong',
    label: '中通',
    icon: zhongtongIcon,
    matchers: [/中通/i, /\bzto\b/i],
  },
  {
    id: 'yuantong',
    label: '圆通',
    icon: yuantongIcon,
    matchers: [/圆通/i, /\byto\b/i],
  },
  {
    id: 'yunda',
    label: '韵达',
    icon: yundaIcon,
    matchers: [/韵达/i, /yunda/i],
  },
  {
    id: 'shentong',
    label: '申通',
    icon: shentongIcon,
    matchers: [/申通/i, /\bsto\b/i],
  },
  {
    id: 'jitu',
    label: '极兔',
    icon: jituIcon,
    matchers: [/极兔/i, /j&t/i, /jtexpress/i],
  },
  {
    id: 'jingdong',
    label: '京东',
    icon: jingdongIcon,
    matchers: [/京东/i, /\bjd\b/i],
  },
  {
    id: 'youzheng',
    label: '邮政',
    icon: youzhengIcon,
    matchers: [/邮政/i, /\bems\b/i, /11183/],
  },
  {
    id: 'cainiao',
    label: '菜鸟',
    icon: cainiaoIcon,
    matchers: [/菜鸟/i, /cainiao/i],
  },
  {
    id: 'fengchao',
    label: '丰巢',
    icon: fengchaoIcon,
    matchers: [/丰巢/i, /fcbox/i],
  },
  {
    id: 'debang',
    label: '德邦',
    icon: debangIcon,
    matchers: [/德邦/i, /deppon/i],
  },
];

export function detectCourierName(text: string, preferredCourier?: string): string {
  const preferred = preferredCourier?.trim();
  if (preferred && preferred !== '未知') {
    const preferredMatch = COURIER_ICON_DEFINITIONS.find(
      (definition) => definition.label === preferred || definition.matchers.some((matcher) => matcher.test(preferred))
    );
    if (preferredMatch) {
      return preferredMatch.label;
    }
    return preferred;
  }

  if (!text) {
    return '未知';
  }

  for (const definition of COURIER_ICON_DEFINITIONS) {
    if (definition.matchers.some((matcher) => matcher.test(text))) {
      return definition.label;
    }
  }

  return '未知';
}

export function getCourierIconSource(courier?: string): string | null {
  if (!courier || courier === '未知') {
    return null;
  }

  const matchedDefinition = COURIER_ICON_DEFINITIONS.find(
    (definition) =>
      definition.label === courier ||
      definition.matchers.some((matcher) => matcher.test(courier))
  );

  return matchedDefinition?.icon ?? null;
}

export function getCourierDisplayLabel(courier?: string): string {
  if (!courier || courier === '未知') {
    return '快递';
  }
  return courier;
}
