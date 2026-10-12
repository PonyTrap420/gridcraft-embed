export function pinnedLicenseSource(pkg, vcs) {
  const git = /^git\+(https:\/\/github\.com\/[\w.-]+\/[\w.-]+)(?:\?[^#]*)?#([a-f0-9]{40})$/.exec(pkg.source ?? "");
  const repo = /^https:\/\/github\.com\/([^/]+)\/([^/#]+?)(?:\.git)?(?:\/.*)?$/.exec(git?.[1] ?? pkg.repository ?? "");
  const commit = git?.[2] ?? vcs?.git?.sha1;
  if ((pkg.source?.startsWith("git+") && !git) || !repo || !/^[a-f0-9]{40}$/.test(commit ?? "")) {
    throw new Error(`Pinned license source missing for ${pkg.name}@${pkg.version}`);
  }
  return `https://raw.githubusercontent.com/${repo[1]}/${repo[2]}/${commit}`;
}
