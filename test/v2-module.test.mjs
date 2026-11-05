import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { spawnSync } from "node:child_process";

test("recovery execution rejects dependencies and bounds module initialization", () => {
  const script = `
    import vm from 'node:vm';
    import assert from 'node:assert/strict';
    const context = vm.createContext({});
    const dependency = new vm.SourceTextModule('import fs from "node:fs"; export const planDispatch=()=>fs;', {context});
    await assert.rejects(dependency.link(() => {throw Error('imports forbidden');}), /imports forbidden/);
    const runaway = new vm.SourceTextModule('while(true){}; export function planDispatch(){}', {context});
    await runaway.link(()=>{});
    await assert.rejects(runaway.evaluate({timeout:30}), /timed out/);
    const clean = new vm.SourceTextModule('export function planDispatch(){return {node:typeof process,fs:typeof require,net:typeof fetch}}', {context});
    await clean.link(()=>{}); await clean.evaluate({timeout:100});
    assert.equal(JSON.stringify(clean.namespace.planDispatch()), JSON.stringify({node:'undefined',fs:'undefined',net:'undefined'}));
  `;
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", "--input-type=module", "-e", script], { encoding: "utf8", timeout: 2000 });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(typeof vm.createContext, "function");
});
