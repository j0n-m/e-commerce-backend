function upperCaseFirstLetters(str: string | string[]): string {
  if (Array.isArray(str)) {
    return str.map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
  }
  return str
    .split(" ")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
function upperCaseFirstLetter(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

export { upperCaseFirstLetters, upperCaseFirstLetter };
