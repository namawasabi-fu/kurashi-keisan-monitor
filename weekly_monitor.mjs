import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// 通常は公開サイト全件を手動検査。--local-only はクラウド用の通信なし計算検査。
const startedAt = new Date().toISOString();
const localOnly = process.argv.includes('--local-only');
const result = spawnSync(process.execPath, [localOnly ? 'calculator_check.mjs' : 'maintenance_check.mjs'], {
  cwd: process.cwd(), encoding: 'utf8', timeout: 180000
});
const output = `${result.stdout || ''}${result.stderr || ''}`;
const counts = /結果: (\d+)件成功 \/ (\d+)件失敗/.exec(output);
const passed = result.status === 0 && !!counts && Number(counts[2]) === 0;
const record = {
  startedAt, finishedAt: new Date().toISOString(),
  mode: localOnly ? 'calculator_logic_only' : 'public_site_and_calculators',
  publicSiteChecked: !localOnly,
  success: passed,
  failureKind: passed ? null : (output.includes('MONITOR_TRANSPORT_ERROR') ? 'monitor_transport_error' : (localOnly ? 'calculator_check_failure' : 'site_check_failure')),
  pass: counts ? Number(counts[1]) : null,
  fail: counts ? Number(counts[2]) : null,
  exitCode: result.status, error: result.error?.message || null,
  output
};
const logDir = path.join('monitor_logs');
fs.mkdirSync(logDir, {recursive:true});
const logFile = path.join(logDir, `${startedAt.slice(0,10)}.json`);
fs.writeFileSync(logFile, JSON.stringify(record, null, 2));
console.log(`${record.success ? 'PASS' : 'FAIL'} ${logFile}: ${record.pass ?? '?'}件成功 / ${record.fail ?? '?'}件失敗`);
if (!record.success) process.exitCode = 1;
