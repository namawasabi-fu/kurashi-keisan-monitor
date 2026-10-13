import {capacity, replacement, led, fridge, usbC} from './calculators_v11.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Shared by the full, local public-site monitor and the network-free cloud run.
export function runCalculatorChecks(check) {
  const bad = fn => { try { fn(); return false; } catch { return true; } };
  check('容量計算回帰', capacity({watts:60,hours:5,efficiency:85,reserve:20,outputMargin:20,surge:''}).wh === 442);
  check('容量計算異常入力', bad(() => capacity({watts:0,hours:5,efficiency:85,reserve:20,outputMargin:20,surge:''})));
  check('買い替え計算回帰', replacement({oldKwh:500,newKwh:300,rate:31,extraCost:30000}).annualYen === 6200);
  check('買い替え回収不可', replacement({oldKwh:300,newKwh:500,rate:31,extraCost:30000}).paybackYears === null);
  check('LED計算回帰', Math.abs(led({oldW:60,newW:9,count:2,hours:4,days:365,rate:31,cost:3000}).annualYen-4616.52) < 1e-8);
  check('LED異常入力', bad(() => led({oldW:60,newW:9,count:1.5,hours:4,days:365,rate:31,cost:3000})));
  check('冷蔵庫計算回帰', fridge({annualKwh:350,rate:31,compareKwh:''}).annualYen === 10850);
  check('冷蔵庫異常入力', bad(() => fridge({annualKwh:'',rate:31,compareKwh:''})));
  check('USB-C計算回帰', usbC({deviceW:45,secondW:20}).totalW === 65);
  check('USB-C異常入力', bad(() => usbC({deviceW:0,secondW:20})));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let pass = 0, fail = 0;
  runCalculatorChecks((name, condition) => {
    console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
    condition ? pass++ : fail++;
  });
  console.log(`結果: ${pass}件成功 / ${fail}件失敗`);
  if (fail) process.exitCode = 1;
}
