export function normalizeString(str: string): string {
  return str
    .normalize('NFD')  // Decompose characters into base + diacritical marks
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritical marks
    .toLowerCase()  // Convert to lowercase for case-insensitive comparison
    .trim();  // Remove leading/trailing whitespace
}

export function normalizePersonName(name: string): string {
  return normalizeString(name);
}

// Function to check if two names are equivalent (ignoring accents and case)
export function areNamesEquivalent(name1: string, name2: string): boolean {
  return normalizePersonName(name1) === normalizePersonName(name2);
} 