import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// 週1回の手動実行向け。公開ページへの書き込みは一切行わない。
const startedAt = new Date().toISOString();
const result = spawnSync(process.execPath, ['maintenance_check.mjs'], {
  cwd: process.cwd(), encoding: 'utf8', timeout: 180000
});
const output = `${result.stdout || ''}${result.stderr || ''}`;
const counts = /結果: (\d+)件成功 \/ (\d+)件失敗/.exec(output);
const passed = result.status === 0 && !!counts && Number(counts[2]) === 0;
const record = {
  startedAt, finishedAt: new Date().toISOString(),
  success: passed,
  failureKind: passed ? null : (output.includes('MONITOR_TRANSPORT_ERROR') ? 'monitor_transport_error' : 'site_check_failure'),
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
