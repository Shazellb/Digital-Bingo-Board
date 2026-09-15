declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;

export interface BuildInfo {
  commit: string;
  date: string;
}

export const BUILD_INFO: BuildInfo = {
  commit: typeof __BUILD_COMMIT__ === 'undefined' ? 'dev' : __BUILD_COMMIT__,
  date: typeof __BUILD_DATE__ === 'undefined' ? 'local' : __BUILD_DATE__,
};

export function formatBuildLabel(info: BuildInfo): string {
  return `Build ${info.commit.slice(0, 7)} · ${info.date}`;
}

export function injectBuildLabels(root: ParentNode = document, info: BuildInfo = BUILD_INFO): void {
  const label = formatBuildLabel(info);
  root.querySelectorAll<HTMLElement>('[data-build-label]').forEach((element) => {
    element.textContent = label;
    element.title = `Digital Bingo Board ${label}`;
  });
}
