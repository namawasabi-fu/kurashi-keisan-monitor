// ページ内に同じ関数を埋め込むため、外部APIやライブラリに依存させない。
export function readV11(value, label, min, max) {
  if (value === null || value === undefined || String(value).trim() === '') throw new Error(`${label}を入力してください`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label}は${min}から${max}の範囲で入力してください`);
  return n;
}

export function capacity(x) {
  const watts = readV11(x.watts, '消費電力', 1, 10000);
  const hours = readV11(x.hours, '希望時間', 0.1, 168);
  const efficiency = readV11(x.efficiency, '変換効率', 1, 100) / 100;
  const reserve = readV11(x.reserve, '容量の余裕', 0, 90) / 100;
  const outputMargin = readV11(x.outputMargin, '出力の余裕', 0, 100) / 100;
  const surge = x.surge === '' || x.surge === undefined ? null : readV11(x.surge, '起動時の最大消費電力', 1, 30000);
  const wh = watts * hours / (efficiency * (1 - reserve));
  return {wh: Math.ceil(wh), continuousW: Math.ceil(watts * (1 + outputMargin)), surgeW: surge === null ? null : Math.ceil(surge), usefulWh: watts * hours};
}

export function replacement(x) {
  const oldKwh = readV11(x.oldKwh, '旧製品の年間消費電力量', 0, 100000);
  const newKwh = readV11(x.newKwh, '新製品の年間消費電力量', 0, 100000);
  const rate = readV11(x.rate, '電力単価', 0.01, 1000);
  const extraCost = readV11(x.extraCost, '買い替えの追加費用', 0, 10000000);
  const annualYen = (oldKwh - newKwh) * rate;
  return {annualYen, paybackYears: annualYen > 0 ? extraCost / annualYen : null, oldAnnualYen: oldKwh * rate, newAnnualYen: newKwh * rate};
}

export function led(x) {
  const oldW = readV11(x.oldW, '交換前の消費電力', 0, 1000);
  const newW = readV11(x.newW, '交換後の消費電力', 0, 1000);
  const count = readV11(x.count, '交換個数', 1, 1000);
  if (!Number.isInteger(count)) throw new Error('交換個数は整数で入力してください');
  const hours = readV11(x.hours, '1日の使用時間', 0, 24);
  const days = readV11(x.days, '年間使用日数', 1, 366);
  const rate = readV11(x.rate, '電力単価', 0.01, 1000);
  const cost = readV11(x.cost, '交換費用の合計', 0, 10000000);
  const annualKwh = (oldW - newW) * count * hours * days / 1000;
  const annualYen = annualKwh * rate;
  return {annualKwh, annualYen, firstYearNetYen: annualYen - cost, paybackYears: annualYen > 0 ? cost / annualYen : null};
}

export function fridge(x) {
  const annualKwh = readV11(x.annualKwh, '年間消費電力量', 0, 100000);
  const rate = readV11(x.rate, '電力単価', 0.01, 1000);
  const compareKwh = x.compareKwh === '' || x.compareKwh === undefined ? null : readV11(x.compareKwh, '比較する冷蔵庫の年間消費電力量', 0, 100000);
  const annualYen = annualKwh * rate;
  return {annualYen, monthlyYen: annualYen / 12, differenceYen: compareKwh === null ? null : (compareKwh - annualKwh) * rate};
}

export function usbC(x) {
  const deviceW = readV11(x.deviceW, '主な機器の必要W数', 1, 240);
  const secondW = x.secondW === '' || x.secondW === undefined ? 0 : readV11(x.secondW, '同時に使う機器の必要W数', 0, 240);
  return {totalW: deviceW + secondW, firstPortW: deviceW, secondPortW: secondW};
}
