// 快递公司短信模板定义
// 每个模板包含发送者号码匹配和短信正文匹配规则

export interface CourierTemplate {
  courier: string;
  senderPatterns: RegExp[];
  bodyPatterns: {
    pattern: RegExp;
    groups: { pickupCode: number; location?: number; address?: number };
  }[];
}

export const COURIER_TEMPLATES: CourierTemplate[] = [
  // 丰巢快递柜
  {
    courier: "丰巢",
    senderPatterns: [/丰巢/i, /fcbox/i],
    bodyPatterns: [
      {
        pattern: /取件码[：:\s]*([A-Za-z0-9-]{4,12})[^]*?([^，。；,;\n]{2,40}(?:快递柜|自提柜))/i,
        groups: { pickupCode: 1, location: 2 },
      },
      {
        pattern: /(?:已存入|已放入)\s*([^，。；,;\n]{2,40}(?:快递柜|自提柜))[^]*?取件码[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 2, location: 1 },
      },
      {
        pattern: /取件码[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 1 },
      },
    ],
  },

  // 菜鸟驿站
  {
    courier: "菜鸟",
    senderPatterns: [/菜鸟/i, /cainiao/i],
    bodyPatterns: [
      {
        pattern: /(?:已存入|已放在|已到)\s*([^，。；,;\n]{2,40}(?:驿站|代收点|服务站|取件点))[^]*?(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 2, location: 1 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})[^]*?([^，。；,;\n]{2,40}(?:驿站|代收点|服务站|取件点))/i,
        groups: { pickupCode: 1, location: 2 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 1 },
      },
    ],
  },

  // 顺丰速运
  {
    courier: "顺丰",
    senderPatterns: [/顺丰/i, /sf[-_]?express/i],
    bodyPatterns: [
      {
        pattern: /(?:已存入|已放入)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜))[^]*?(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 2, location: 1 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})[^]*?([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜))/i,
        groups: { pickupCode: 1, location: 2 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 1 },
      },
    ],
  },

  // 中通快递
  {
    courier: "中通",
    senderPatterns: [/中通/i, /zto/i],
    bodyPatterns: [
      {
        pattern: /(?:已存入|已放入)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜))[^]*?(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 2, location: 1 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 1 },
      },
    ],
  },

  // 圆通速递
  {
    courier: "圆通",
    senderPatterns: [/圆通/i, /yto/i],
    bodyPatterns: [
      {
        pattern: /(?:已存入|已放入)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜))[^]*?(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 2, location: 1 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 1 },
      },
    ],
  },

  // 韵达快递
  {
    courier: "韵达",
    senderPatterns: [/韵达/i, /yunda/i],
    bodyPatterns: [
      {
        pattern: /(?:已存入|已放入)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜))[^]*?(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 2, location: 1 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 1 },
      },
    ],
  },

  // 申通快递
  {
    courier: "申通",
    senderPatterns: [/申通/i, /sto/i],
    bodyPatterns: [
      {
        pattern: /(?:已存入|已放入)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜))[^]*?(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 2, location: 1 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 1 },
      },
    ],
  },

  // 极兔速递
  {
    courier: "极兔",
    senderPatterns: [/极兔/i, /j&t/i, /jtexpress/i],
    bodyPatterns: [
      {
        pattern: /(?:已存入|已放入)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜))[^]*?(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 2, location: 1 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 1 },
      },
    ],
  },

  // 京东快递
  {
    courier: "京东",
    senderPatterns: [/京东/i, /jd/i],
    bodyPatterns: [
      {
        pattern: /(?:已存入|已放入)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜))[^]*?(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 2, location: 1 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 1 },
      },
    ],
  },

  // 邮政/EMS
  {
    courier: "邮政",
    senderPatterns: [/邮政/i, /ems/i, /11183/],
    bodyPatterns: [
      {
        pattern: /(?:已存入|已放入)\s*([^，。；,;\n]{2,40}(?:驿站|快递柜|代收点|服务站|自提柜))[^]*?(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 2, location: 1 },
      },
      {
        pattern: /(?:取件码|凭)[：:\s]*([A-Za-z0-9-]{4,12})/i,
        groups: { pickupCode: 1 },
      },
    ],
  },
];
