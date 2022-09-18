export const isTouchOnly = (): boolean => {
  return window.matchMedia("(any-hover: none)").matches;
};

export const isInPortrait = (): boolean => {
  return screen.availHeight > screen.availWidth;
};
