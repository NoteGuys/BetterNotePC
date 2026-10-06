// Translate only the suffix produced by Duplicate. Never rewrite stored titles.
export const NOTEBOOK_COPY_LABELS = ['Copy', 'สำเนา', '副本', 'Копия'];
const COPY_TAIL = /(?: \((?:Copy|สำเนา|副本|Копия)\)(?:\([1-9]\d*\))?)+$/u;
const COPY_LABEL = /\((?:Copy|สำเนา|副本|Копия)\)/gu;

export const localizeNotebookCopyName = (name, copyLabel) => {
  if (typeof name !== 'string' || !NOTEBOOK_COPY_LABELS.includes(copyLabel)) return name;
  return name.replace(COPY_TAIL, suffix => suffix.replace(COPY_LABEL, () => '(' + copyLabel + ')'));
};
