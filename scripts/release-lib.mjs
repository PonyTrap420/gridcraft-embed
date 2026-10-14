import {execFileSync} from "node:child_process";
import {readFileSync, writeFileSync} from "node:fs";
export const readJson = path => JSON.parse(readFileSync(path, "utf8"));
export const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
export function run(command, args, options = {}) {
  return (execFileSync(command, args, {stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", ...options}) ?? "").trim();
}
export function nextRelease(releases, state) {
  const key = value => [Date.parse(value.published_at ?? value.publishedAt), value.id ?? value.releaseId];
  const [time, id] = key(state);
  return releases.filter(r => !r.draft && r.published_at && (key(r)[0] > time || key(r)[0] === time && r.id > id))
    .sort((a, b) => key(a)[0] - key(b)[0] || a.id - b.id)[0];
}
export function nextVersion(version, release) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[\w.-]+)?$/.exec(version);
  if (!match) throw new Error(`Unsupported package version: ${version}`);
  const base = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
  return release.prerelease ? `${base}-upstream.${release.id}` : base;
}
export async function github(path, {method = "GET", body, allowMissing = false} = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(process.env.GH_TOKEN ? {Authorization: `Bearer ${process.env.GH_TOKEN}`} : {})},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  if (allowMissing && response.status === 404) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(`GitHub ${method} ${path}: ${response.status} ${data.message}`);
  return data;
}
export async function registryVersion(name, version) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`npm registry returned ${response.status}`);
  return response.json();
}
